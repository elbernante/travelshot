'''
Module containing rest API end points.
Contains 2 major modules
    1. authentication - Handles authentication-related requests
    2. interface - Handles CRUD-related requests
'''

from flask import Blueprint

from ..utils import util

api = Blueprint('api', __name__)

########## Error Handlers ############
def _error_message(error, message):
    '''Standard API error response format.'''

    return {
        'error': {
            'message': message,
            'type':  type(error).__name__,
            'code': error.code,
            'description': str(error.description)
        }
    }


@api.errorhandler(400)
@util.format_response
def bad_request(error):
    '''Error reponse for bad requests.'''
    return _error_message(error, 'Bad request error.'), \
        error.code


@api.errorhandler(401)
@util.format_response
def unauthorized_request(error):
    '''Error response for unauthorized request
    (e.g. requires authentication).
    '''

    return _error_message(error, 'Request is unauthorized.'), \
        error.code


@api.errorhandler(403)
@util.format_response
def forbidden_request(error):
    '''Error response for forbidden requests
    (e.g. cannot delete resource with existing dependents).
    '''

    return _error_message(error, 'The request is forbidden.'), \
        error.code


@api.errorhandler(404)
@util.format_response
def not_found(error):
    '''Error response for non-existent API end points.'''

    return _error_message(error, \
        'The end point you requested was not found.'), \
        error.code


@api.errorhandler(405)
@util.format_response
def not_allowed(error):
    '''Error response for not allowed requests.'''

    return _error_message(error, \
        'The reuqest method is not allowed for this end point.'), \
        error.code
