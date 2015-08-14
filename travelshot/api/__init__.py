from flask import Blueprint

from ..utils import util

api = Blueprint('api', __name__)


########## Error Handlers ############
def _error_message(e, message):
    return {
        'error': {
            'message': message,
            'type':  type(e).__name__,
            'code': e.code,
            'description': str(e.description)
        }
    }

@api.errorhandler(400)
@util.format_response
def bad_request(e):
    return _error_message(e, 'Bad request error.'), \
        e.code

@api.errorhandler(401)
@util.format_response
def unauthorized_request(e):
    return _error_message(e, 'Request is unauthorized.'), \
        e.code

@api.errorhandler(403)
@util.format_response
def forbidden_request(e):
    return _error_message(e, 'The request is forbidden.'), \
        e.code

@api.errorhandler(404)
@util.format_response
def not_found(e):
    return _error_message(e, 'The end point you requested was not found.'), \
        e.code

@api.errorhandler(405)
@util.format_response
def not_allowed(e):
    return _error_message(e, 'The reuqest method is not allowed for this end point.'), \
        e.code
