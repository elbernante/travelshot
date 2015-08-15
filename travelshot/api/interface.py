'''
API Module
Contains routes for API calls returning
JSON or XML format.
'''

import os

from flask import request
from flask import url_for
from flask import session as login_session
from flask import current_app as app

from werkzeug.exceptions import BadRequest

from ..utils import util
from ..utils import datastore as ds

from . import api


@api.route('/upload/', methods=['POST'])
@util.require_login
@util.format_response
def upload():

    image = request.files.get('image', None)
    if image is None or not util.allowed_file(image.filename):
        raise BadRequest('Invalid image.')

    img_type = image.filename.rsplit('.', 1)[1]

    item = ds.new_item({
        'title': request.form.get('title', None),
        'category': request.form.get('category', None),
        'description': request.form.get('description', None),
        'image_type': img_type,
        'author': login_session.get('user_id', None)
        })

    if item is None:
        raise BadRequest('Invalid upload request.')

    image_filename = '{}.{}'.format(item.id, img_type)
    image.save(os.path.join(os.getcwd() + app.config['UPLOAD_FOLDER'], image_filename))

    item_dict = item.serialize
    item_dict['image_url'] = url_for('pages.view_mage', filename=image_filename)
    return item_dict


