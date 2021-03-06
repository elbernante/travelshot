'''
Contains API end points related to user authentication.

The returned response can either be JSON or XML format.

The response format is determined from `?format=` query parameter of the request URL.
If none is supplied, defaults to JSON.

Valid values for format parameter:
    - json
    - xml
'''

import requests

try:
    from urlparse import parse_qs
except ImportError:
    # python 3
    from urllib.parse import parse_qs

from flask import request
from flask import session as login_session
from flask import current_app as app

from werkzeug.exceptions import BadRequest, Unauthorized

from oauth2client.client import flow_from_clientsecrets
from oauth2client.client import FlowExchangeError
from oauth2client.client import OAuth2Credentials

from ..utils import util
from ..utils import datastore as ds

from . import api


@api.route('/currentuser/', methods=['GET'])
@util.csrf_protect_enable
@util.format_response
def get_current_user():
    '''Returns the currently logged in user. CSRF-protected.

    Requires:
        CSRF token. The request must include a CSRF token to use this end point.

    Returns: User object representing the user that is currently logged in.
                Returns `false` if there is none.
    '''

    if login_session.get('user_id', None) is None:
        return 'false'

    current_user = ds.get_user_by_id(login_session['user_id'])
    if current_user is None:
        return 'false'
    return current_user.serialize


@api.route('/requestlogin/', methods=['GET'])
@util.csrf_protect_enable
@util.format_response
def login_key():
    '''Returns keys needed for logging in with third party authentication
    service (i.e. Google Plus and Facebook). CSRF-protected.

    Requires:
        CSRF token. The request must include a CSRF token to use this end point.

    Returns: Dictionary of keys for each supported authentication service.
    '''

    state = util.random_key()
    key_set = {
        "state": state,
        "gplus_options": {
            "client_id": app.config['CLIENT_ID'],
            "scope": "profile email",
            "cookie_policy": "single_host_origin",
        },
        "fb_options": {
            "appId": app.config['FB_APP_ID'],
            "cookie": True,
            "xfbml": False,
            "version": "v2.4"
        }
    }
    return key_set


def _upgrade_code_to_credentials(auth_code):
    '''Upgrades an authorization code into a credentials object'''

    try:
        oauth_flow = flow_from_clientsecrets('g_client_secrets.json', scope='')
        oauth_flow.redirect_uri = 'postmessage'
        credentials = oauth_flow.step2_exchange(auth_code)
        return credentials, 'Success'
    except FlowExchangeError:
        return None, 'Failed to upgrade the authorization code.'


def _verifiy_access_token(access_token, gplus_id):
    '''Verify access token is valid.'''

    # Get token info
    url = 'https://www.googleapis.com/oauth2/v2/tokeninfo'
    params = {'access_token': access_token}
    response = util.to_json(requests.get(url, params=params).text)

    # If there was an error in the access token info, abort.
    if not response or response.get('error') is not None:
        return False, 'Failed to verify access token.'

    # Verify that the access token is used for the intended user.
    if response.get('user_id') != gplus_id:
        return False, 'Invalid token user ID.'

    # Verify that the access token is valid for this app.
    if response.get('issued_to') != app.config['CLIENT_ID']:
        return False, 'Invalid token client ID.'

    return True, 'Success'


def _g_plus_get_user_info(credentials):
    '''Gets the user info from G Plus.'''

    # Get user info
    userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
    params = {'access_token': credentials.access_token, 'alt': 'json'}
    user_info = util.to_json(requests.get(userinfo_url, params=params).text)
    if not user_info or user_info.get('error'):
        return None, 'Failed to retrieve user information.'
    return user_info, 'Success'


def _dump_user_info_to_session(user_info, provider):
    '''Saves the user info into the session.'''

    login_session['provider'] = provider

    login_session['email'] = user_info.get('email', None)
    login_session['name'] = user_info.get('name', None)
    login_session['first_name'] = user_info.get('given_name', None) \
        or user_info.get('first_name', None)
    login_session['middle_name'] = user_info.get('middle_name', None)
    login_session['last_name'] = user_info.get('family_name', None) \
        or user_info.get('last_name', None)
    login_session['locale'] = user_info.get('locale', None)
    login_session['gender'] = user_info.get('gender', None)
    login_session['link'] = user_info.get('link', None)
    login_session['verified_email'] = user_info.get('verified_email', None)

    # Picture URL in facebook is inside a picture object
    picture = user_info.get('picture', None)
    if isinstance(picture, (dict, list)):
        picture = picture.get('data', {}).get('url', None)

    login_session['picture'] = picture

    return True


@api.route('/gconnect/', methods=['POST'])
@util.csrf_protect_enable
@util.format_response
def gconnect():
    '''Authenticates the user through G Plus service. CSRF-protected.

    Requires:
        CSRF token. The request must include a CSRF token to use this end point.

    Parameters:
        authentication code - Required. The request must contain, and only
                                containd, authentication code acquired from
                                G Plus authentication service. The request
                                content-type must be set to
                                `application/octet-stream; charset=utf-8`.

    Returns: User info object is authentication is successful. Otherwise returns
                an error object.

    '''

    # Read submitted authorization code
    code = request.data

    # Upgrade the authorization code into a credentials object
    (credentials, message) = _upgrade_code_to_credentials(code)
    if credentials is None:
        raise Unauthorized(message)

    # Verify access token is valid.
    access_token = credentials.access_token
    gplus_id = credentials.id_token['sub']
    (is_valid_token, message) = _verifiy_access_token(access_token, gplus_id)
    if not is_valid_token:
        raise Unauthorized(message)

    # Check if user is already logged in
    stored_credentials = login_session.get('credentials')
    stored_gplus_id = login_session.get('gplus_id')
    if stored_credentials is not None and gplus_id == stored_gplus_id:
        # User is already logged in
        return _get_current_user().serialize

    # Get user info
    (user_info, message) = _g_plus_get_user_info(credentials)
    if user_info is None:
        raise Unauthorized(message)

    # Dump user info to session
    _dump_user_info_to_session(user_info, 'google')
    login_session['credentials'] = credentials.to_json()
    login_session['gplus_id'] = credentials.id_token['sub']


    # Check if user already exists, create new otherwise
    user = ds.get_user_by_gplus_id(login_session['gplus_id'])
    if user is None:
        user = ds.create_user(login_session)

    login_session['user_id'] = user.id

    return user.serialize

def _clean_up_session():
    '''Cleans up the stored user info in the login_session when the logs out '''

    # Remove store login session data
    login_session['user_id'] = None

    login_session['credentials'] = None     # G+ Specific
    login_session['gplus_id'] = None        # G+ Specific

    login_session['access_token'] = None    # Facebook Specific
    login_session['facebook_id'] = None     # Facebook Specific

    login_session['provider'] = None

    login_session['name'] = None
    login_session['email'] = None
    login_session['first_name'] = None
    login_session['middle_name'] = None
    login_session['last_name'] = None
    login_session['locale'] = None
    login_session['gender'] = None
    login_session['link'] = None
    login_session['picture'] = None
    login_session['verified_email'] = None


@api.route('/gdisconnect/', methods=['GET'])
@util.format_response
def gdisconnect():
    '''Revokes the G Plus credentials of the user when the user logs out.

    Returns: Success object if successful. Otherwise returns an error object.
    '''

    credentials = login_session.get('credentials')
    if credentials is None:
        raise Unauthorized("User is not signed in.")

    _clean_up_session()

    access_token = OAuth2Credentials.from_json(credentials).access_token
    url = 'https://accounts.google.com/o/oauth2/revoke'
    params = {'token': access_token}
    response = requests.get(url, params=params)
    if response.status_code != 200:
        raise BadRequest('Failed to revoke token.')

    return {'success': True}


def _get_long_live_access_token(short_live_token):
    '''Exchanges the short-live token for a long-live token from Facebook.'''

    # Obtain long-lived access token
    url = 'https://graph.facebook.com/oauth/access_token'
    params = {
        'grant_type': 'fb_exchange_token',
        'client_id': app.config['FB_APP_ID'],
        'client_secret': app.config['FB_APP_SECRET'],
        'fb_exchange_token': short_live_token
    }
    response = requests.get(url, params=params)

    # Read the access_token
    access_token = parse_qs(response.text).get('access_token', None)
    if access_token is None:
        return None, 'No access token recieved from authorization server.'

    return access_token[0], 'Success'


def _fb_get_user_info(access_token):
    '''Gets the user info from Facebook.'''

    # Get user info
    fields = ['id', 'email', 'name', 'first_name', 'middle_name', 'gender', \
                'last_name', 'link', 'locale', 'picture']
    url = 'https://graph.facebook.com/v2.4/me'
    params = {
        'fields': ','.join(fields),
        'access_token': access_token
    }

    user_info = util.to_json(requests.get(url, params=params).text)

    if not user_info or user_info.get('error'):
        return None, 'Failed to retrieve user information.'

    return user_info, 'Success'


@api.route('/fbconnect/', methods=['POST'])
@util.csrf_protect_enable
@util.format_response
def fbconnect():
    '''Authenticates the user through Facebook service. CSRF-protected.

    Requires:
        CSRF token. The request must include a CSRF token to use this end point.

    Parameters:
        short-live access token - Required. The request must contain, and only
                                containd, short-live access token acquired from
                                Facebook authentication service. The request
                                content-type must be set to
                                `application/octet-stream; charset=utf-8`.

    Returns: User info object is authentication is successful. Otherwise returns
                an error object.

    '''

    # Read access token
    temp_access_token = request.data

    # Obtain long-lived access token
    (access_token, message) = _get_long_live_access_token(temp_access_token)
    if access_token is None:
        raise Unauthorized(message)

    # Get user info
    (user_info, message) = _fb_get_user_info(access_token)
    if user_info is None:
        raise Unauthorized(message)

    # Check if user is already logged in
    stored_access_token = login_session.get('access_token')
    stored_fb_id = login_session.get('facebook_id')
    if stored_access_token is not None and user_info['id'] == stored_fb_id:
        # User is already logged in
        return _get_current_user().serialize

    # Dump user info to session
    _dump_user_info_to_session(user_info, 'facebook')
    login_session['access_token'] = access_token
    login_session['facebook_id'] = user_info['id']

    # Check if user already exists, create new otherwise
    user = ds.get_user_by_facebook_id(login_session['facebook_id'])
    if user is None:
        user = ds.create_user(login_session)

    login_session['user_id'] = user.id

    return user.serialize


@api.route('/fbdisconnect/', methods=['GET'])
@util.format_response
def fbdisconnect():
    '''Revokes the user access token when the user logs out.'''

    access_token = login_session.get('access_token')
    facebook_id = login_session['facebook_id']
    if access_token is None:
        raise Unauthorized("User is not signed in.")

    _clean_up_session()

    url = 'https://graph.facebook.com/{}/permissions'.format(facebook_id)
    params = {'access_token': access_token}
    response = requests.delete(url, params=params)

    if response.status_code != 200:
        raise BadRequest('Failed to revoke token.')

    return {'success': True}


@api.route('/logout/', methods=['GET'])
@util.require_login
def log_out():
    '''Logs out the current user.
    Invokes either gdisconnect() or fbdisconnect() depending on what the user
    used to log in.
    '''

    if login_session['provider'] == 'google':
        return gdisconnect()
    elif login_session['provider'] == 'facebook':
        return fbdisconnect()
    else:
        raise BadRequest('Invalid login session.')


def _get_current_user():
    '''Returns the info of the currently logged in user.'''

    current_user = ds.get_user_by_id(login_session['user_id'])
    if current_user is None:
        raise BadRequest('Invalid login session')
    return current_user
