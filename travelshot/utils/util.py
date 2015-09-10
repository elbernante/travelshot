'''
Contains utility functions to be used by other modules.
'''

import sys
import json
import random
import string
from functools import wraps

from flask import request
from flask import url_for
from flask import make_response
from flask import render_template
from flask import session as login_session
from flask import current_app as app

from werkzeug.exceptions import Unauthorized

from ..lib.dicttoxml import dicttoxml
from ..lib.flask_csrf.csrf import CsrfProtect

from . import datastore as ds

PY2 = sys.version_info[0] == 2

if PY2:
    xrange = xrange
    text_type = unicode
else:
    xrange = range
    text_type = str

csrf = CsrfProtect()


def format_response(func):
    '''Decorator to format respones in either JSON or XML format.'''

    @wraps(func)
    def wrapper(*args, **kwargs):
        '''Formats the returned value of func to either JSON or XML format.
        The format is read from `?format=` query param of the request URL.
        If none is supplied, defaults to JSON.

        Returns:
            Response object with JSON or XML content. The `content_type` header
            is automatically set to either 'application/json' or
            'application/xml'.


        Expected return value from the wrapped function:
            return_value    : Required. The value to be sent as response.
                              Can be any type that can be converted to JSON or
                              XML
                              (e.g. dictionary, list, string, numeric)
            status_code     : Optional. Integer or string status code to be sent
            headers         : Optional. List of dictionary with header values
        '''

        ret_val = func(*args, **kwargs)

        # get the returned value
        headers_or_code = headers = None
        if isinstance(ret_val, tuple):
            ret_val, headers_or_code, headers = ret_val + (None,) \
                * (3 - len(ret_val))

        if isinstance(headers_or_code, (dict, list)):
            headers, headers_or_code = headers_or_code, None

        data_format = 'json'

        if request and request.args:
            requested_format = text_type(request.args.get('format', '')).lower()
            if requested_format == 'xml':
                data_format = 'xml'

        (formatted, content_type) = format_data(ret_val, data_format)

        resp = make_response(formatted, headers_or_code, headers)
        resp.mimetype = content_type
        return resp
    return wrapper


def format_data(data, data_format='json'):
    '''Converts data into json or xml format.

    Parameters:
        data         - Required. Any value convertible to JSON or XML.
        datas_format - Required. String. Should either be 'json' or 'xml'. The
                        format to convert data to. Defaults to 'json'.

    Returns: Tuple containing the formatted data and the content type. The
                content type will be set to either `application/json` or
                `application/xml` accordingly.
    '''
    if data_format == 'xml':
        formatted = dicttoxml(data, attr_type=False)
        content_type = 'application/xml'
    else:
        formatted = json.dumps(data, ensure_ascii=False)
        content_type = 'application/json'
    return formatted, content_type


def csrf_protect_enable(func):
    '''Decorator for to check for csrf token.'''

    @wraps(func)
    def wrapper(*args, **kwargs):
        '''Checks for CSRF token in the request. Raises an error is none is
        found.
        '''

        csrf.protect()
        return func(*args, **kwargs)
    return wrapper


def require_login(func):
    '''Decorator to check if there is currently logged in user. Raises an
    Unauthorized exception if there is none.
    '''

    @wraps(func)
    def wrapper(*args, **kwargs):
        '''Checks if there is a user saved in the login session.'''

        if login_session.get('user_id', None) is None:
            raise Unauthorized('Requires to be logged in to perform this \
                    operation.')
        return func(*args, **kwargs)
    return wrapper


@format_response
def format_data_response(data):
    '''Coverts data to either JSON or XML format and returns it as a Response
    object.
    '''

    return data


def smart_request(func):
    '''Decorator for page requests. Returns either the HTML for the single-
    page web app, or the data object that tells the front-end web app which page
    to render.

    If the request includes a query argument `d=1`, the decorator returns the
    resulting value of the function it decorated from (i.e. tells the front-end
    web app which page to render). Otherwise, it returns the HTML page.

    If it returns a data value, the format can either be JSON or XML which can
    be specified with `format=json` or `format=xml` query argument. Defaults to
    JSON format.
    '''

    @wraps(func)
    def wrapper(*args, **kwargs):
        '''Check whether the request contains `d=1` query argument and returns
        the resulting value from the decorated function. Otherwise, returns the
        HTML page.
        '''

        is_requesting_data = False
        if request and request.args:
            is_requesting_data = request.args.get('d', '0') == '1'

        if is_requesting_data:
            return format_data_response(func(*args, **kwargs))

        return render_template('index.html')
    return wrapper


def random_key():
    '''Returns a random 32-character string.'''

    return ''.join(random.choice(string.ascii_uppercase + string.digits) \
                for x in xrange(32))


def allowed_file(filename):
    '''Checks if the specified filename has a valid file extension.

    Parameters:
        filename - Required. String. The filename to be checked.

    Returns: True if the extension of filename is valid, False otherwise.
    '''

    return '.' in filename and \
           filename.rsplit('.', 1)[1] in app.config['ALLOWED_EXTENSIONS']


def serialize_item_object(item_obj):
    '''Returns a serialized Item object, including URL for the image and
    serialized author and category objects.

    Parameters:
        item_obj - Required. Item object. The item to be serialized.

    Returns: Dictionary representing the serialied Item object.
    '''

    item_dict = item_obj.serialize
    image_filename = '{}.{}'.format(item_obj.id, item_obj.image_type)
    item_dict['image_url'] = url_for('pages.view_mage',
                                     key=item_obj.salt,
                                     filename=image_filename)

    user = ds.get_user_by_id(item_obj.author_id)
    if user is None:
        author = {
            'id': item_obj.author_id,
            'name': 'Unknown',
            'picture': url_for('static', filename='images/user.jpg')
        }
    else:
        author = {
            'id': item_obj.author_id,
            'name': user.name,
            'picture': user.picture
        }

    item_dict['author'] = author
    del item_dict['author_id']

    cat = ds.get_category_by_id(item_obj.category_id)
    if cat is None:
        category = {
            'id': item_obj.category_id,
            'name': 'Uncategorized'
        }
    else:
        category = cat.serialize

    item_dict['category'] = category
    del item_dict['category_id']

    return item_dict


def to_json(text):
    '''Parses a text representing a JSON object. If an error occured during
    parsing, returns None instead of raising and exception.

    Parameters:
        text - Required. String. A string representing a JSON object.

    Returns: A dictionary, or None if an error occured.
    '''

    try:
        return json.loads(text, encoding='utf-8')
    except ValueError:
        return None
