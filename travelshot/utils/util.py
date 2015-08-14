'''
Contains utility functions
'''

import sys
import json
import random
import string
from functools import wraps

from flask import request
from flask import make_response
from flask import session as login_session

from werkzeug.exceptions import Unauthorized

from ..lib.dicttoxml import dicttoxml

PY2 = sys.version_info[0] == 2

if PY2:
    xrange = xrange
else:
    xrange = range

def format_response(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        '''Formats the returned value of func to either JSON or XML format.
        The format is read from `?format=` query param of the request URL.
        If none is supplied, defaults to JSON.

        Returns:
            Response object with JSON or XML content. The `content_type` header
            is automatically set to either 'application/json' or 'application/xml'.


        Expected return value from the wrapped function:
            return_value    : Required. The value to be sent as response.
                              Can be any type that can be converted to JSON or XML
                              (e.g. dictionary, list, string, numeric)
            status_code     : Optional. Integer or string status code to be sent
            headers         : Optional. List of dictionary with header values
        '''
        ret_val = func(*args, **kwargs)

        # get the returned value
        headers_or_code = headers = None
        if isinstance(ret_val, tuple):
            ret_val, headers_or_code, headers = ret_val + (None,) * (3 - len(ret_val))

        if isinstance(headers_or_code, (dict, list)):
            headers, headers_or_code = headers_or_code, None

        format = 'json'

        if request and request.args:
            requested_format = str(request.args.get('format', '')).lower()
            if requested_format == 'xml':
                format = 'xml'

        (formatted, content_type) = format_data(ret_val, format)

        resp = make_response(formatted, headers_or_code, headers)
        resp.mimetype = content_type
        return resp
    return wrapper

def validate_token(key):
    def token_validator(func):
        @wraps(func)
        def validator_wrapper(*args, **kwargs):

            is_valid = False
            stored_token = login_session.get(key, '')
            if request:
                if request.method == 'POST':
                    if request.form.get(key, '') == stored_token:
                        is_valid = True

                if not is_valid:
                    if request.headers.get(key, '') == stored_token:
                        is_valid = True

                if not is_valid:
                    if request.args.get(key, '') == stored_token:
                        is_valid = True

            if not is_valid:
                raise Unauthorized('Invalid token.')

            return func(*args, **kwargs)
        return validator_wrapper
    return token_validator

def random_key():
    return ''.join(random.choice(string.ascii_uppercase + string.digits) for x in xrange(32))

def format_data(data, data_format):
    if data_format == 'xml':
        formatted = dicttoxml(data, attr_type=False)
        content_type = 'application/xml'
    else:
        formatted = json.dumps(data, ensure_ascii=False)
        content_type = 'application/json'
    return formatted, content_type

def to_json(text):
    try:
        return json.loads(text, encoding='utf-8')
    except:
        return None
