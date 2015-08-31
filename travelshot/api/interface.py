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
from werkzeug.exceptions import Unauthorized

from ..utils import util
from ..utils import datastore as ds

from . import api

import json

def serialize_item_object(itemObj):
    item_dict = itemObj.serialize
    image_filename = '{}.{}'.format(itemObj.id, itemObj.image_type)
    item_dict['image_url'] = url_for('pages.view_mage', key=itemObj.salt, filename=image_filename)
    return item_dict


@api.route('/featured/', methods=['GET'])
@util.format_response
def featured_images():
    images = [
        url_for('static', filename='images/cover_1.jpg'),
        url_for('static', filename='images/cover_2.jpg'),
        url_for('static', filename='images/cover_3.jpg')
    ]
    return images

@api.route('/categories/', methods=['GET'])
@util.format_response
def get_categories():
    res = ds.get_categories()
    cats = []
    for v in res:
        cats.append(v.serialize)
    return cats

@api.route('/items/<int:category_id>/', methods=['GET'])
@util.format_response
def get_items_for_category(category_id):
    print(type(category_id))
    res = ds.get_items_for_category(category_id)
    items = []
    for v in res:
        items.append(serialize_item_object(v))
    return items

@api.route('/items/latest/', methods=['GET'])
@util.format_response
def get_latest_items():
    res = ds.get_latest_items()
    items = []
    for v in res:
        items.append(serialize_item_object(v))
    return items

@api.route('/item/new/', methods=['POST'])
@util.csrf_protect_enable
@util.require_login
@util.format_response
def upload_new_item():

    image = request.files.get('image', None)
    if image is None or not util.allowed_file(image.filename):
        raise BadRequest('Invalid image.')

    img_type = image.filename.rsplit('.', 1)[1]

    item = ds.new_item({
        'title': request.form.get('title', None),
        'category': request.form.get('category', None),
        'description': request.form.get('description', None),
        'image_type': img_type,
        'author': login_session.get('user_id', None),
        'salt': util.random_key()
        })

    if item is None:
        raise BadRequest('Invalid upload request.')

    image_filename = '{}.{}'.format(item.id, img_type)
    image.save(os.path.join(os.getcwd() + app.config['UPLOAD_FOLDER'], image_filename))

    # TODO: Remove commented code
    # item_dict = item.serialize
    # item_dict['image_url'] = url_for('pages.view_mage', key=item.salt, filename=image_filename)
    return serialize_item_object(item)


@api.route('/item/edit/<item_id>/', methods=['POST'])
@util.csrf_protect_enable
@util.require_login
@util.format_response
def edit_item(item_id):

    if request.content_type == 'application/json':
        data = request.json
    else:
        data = request.form

    if data is None:
        raise BadRequest('Invalid edit request.')

    if item_id != data.get('item_id', None):
        raise BadRequest('Invalid item.')

    item = ds.get_item_by_id(item_id)
    if item is None:
        raise BadRequest('Invalid item.')

    if item.author_id != login_session.get('user_id'):
        raise Unauthorized('Edit access denied.')

    item.title = data.get('title', None) or item.title
    item.category_id = data.get('category', None) or item.category_id
    item.description = data.get('description', None) or item.description

    # Check if image was changed
    image = request.files.get('image', None)
    if image is not None:
        if not util.allowed_file(image.filename):
            raise BadRequest('Invalid image.')

        img_type = image.filename.rsplit('.', 1)[1]
        item.image_type = img_type

    item = ds.save_item(item)
    if item is None:
        raise BadRequest('Error updating item.')

    image_filename = '{}.{}'.format(item.id, item.image_type)
    if image is not None:
        image.save(os.path.join(os.getcwd() + app.config['UPLOAD_FOLDER'], image_filename))

    # TODO: Remove commented code
    # item_dict = item.serialize
    # item_dict['image_url'] = url_for('pages.view_mage', key=item.salt, filename=image_filename)
    return serialize_item_object(item)


# @api.route('/tesapi/', methods=['GET', 'POST'])
# @util.format_response
# def test_api_route():
#     print(request.content_type)
#     if request.content_type == 'application/json':
#         print json.dumps(request.json)
#     print(request.data)
#     print("By form:")
#     for k, v in request.form.items():
#         print(k, v)
#     return 'OK'


# fh = open("imageToSave.png", "wb")
# fh.write(imgData.decode('base64'))
# fh.close()


