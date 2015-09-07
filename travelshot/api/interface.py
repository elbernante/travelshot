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
from werkzeug.exceptions import NotFound

from ..utils import util
from ..utils import datastore as ds

from . import api

# TODO: Remove this unused import
import json

def serialize_item_object(itemObj):
    item_dict = itemObj.serialize
    image_filename = '{}.{}'.format(itemObj.id, itemObj.image_type)
    item_dict['image_url'] = url_for('pages.view_mage', key=itemObj.salt, filename=image_filename)

    user = ds.get_user_by_id(itemObj.author_id)
    if user is None:
        author = {
            'id': itemObj.author_id,
            'name': 'Unknown',
            'picture': url_for('static', filename='images/user.jpg')
        }
    else:
        author = {
            'id': itemObj.author_id,
            'name': user.name,
            'picture': user.picture
        }
    item_dict['author'] = author
    del item_dict['author_id']

    cat = ds.get_category_by_id(itemObj.category_id)
    if cat is None:
        category = {
            'id': itemObj.category_id,
            'name': 'Uncategorized'
        }
    else:
        category = cat.serialize
    item_dict['category'] = category
    del item_dict['category_id']

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

@api.route('/myitems/', methods=['GET'])
@util.csrf_protect_enable
@util.require_login
@util.format_response
def my_items():
    res = ds.get_items_by_author(login_session['user_id'])
    items = []
    for i in res:
        items.append(serialize_item_object(i))
    return items

@api.route('/items/latest/', methods=['GET'])
@util.format_response
def get_latest_items():
    res = ds.get_latest_items()
    items = []
    for v in res:
        items.append(serialize_item_object(v))
    return items

@api.route('/categories/', methods=['GET'])
@util.format_response
def get_categories():
    res = ds.get_categories()
    cats = []
    for v in res:
        cats.append(v.serialize)
    return cats

@api.route('/category/<int:category_id>/items/', methods=['GET'])
@util.format_response
def get_category_items(category_id):
    category = ds.get_category_by_id(category_id)
    if category is None:
        raise NotFound('Category not found.')

    query = ds.get_all_items_for_category(category_id)
    items = []
    for i in query:
        items.append(serialize_item_object(i))

    return {
        'category': category.serialize,
        'items': items
    }

# TODO: Remove this
@api.route('/items/<int:category_id>/', methods=['GET'])
@util.format_response
def get_items_for_category(category_id):
    res = ds.get_items_for_category(category_id)
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

@api.route('/item/<int:item_id>/', methods=['GET'])
@util.format_response
def get_item(item_id):
    item = ds.get_item_by_id(item_id)
    if item is None:
        raise NotFound('Item not found')
    return serialize_item_object(item)

@api.route('/item/<int:item_id>/edit/', methods=['POST'])
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

    try:
        req_item_id = int(data.get('item_id', None))
    except ValueError:
        raise BadRequest('Invalid item ID.')

    if item_id != req_item_id:
        raise BadRequest('Invalid item.')

    item = ds.get_item_by_id(item_id)
    if item is None:
        raise NotFound('Item not found.')

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
        item.salt = util.random_key()

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

@api.route('/item/<int:item_id>/delete/', methods=['GET', 'POST'])
@util.csrf_protect_enable
@util.require_login
@util.format_response
def delete_item(item_id):
    item = ds.get_item_by_id(item_id)
    if item is None:
        raise NotFound('Item not found.')

    if item.author_id != login_session.get('user_id'):
        raise Unauthorized('Delete access denied.')

    token_key = 'delete_nonce_token'
    key = '{}:{}'.format(token_key, item_id)
    if request.method == 'GET':
        login_session[key] = util.random_key()
        return {'nonce_token': login_session[key]}
    else:
        token = request.json.get('nonce_token', None)
        if token is None:
            raise BadRequest('Invalid nonce token.')

        stored_token = login_session.get(key, None)
        if stored_token != token:
            raise BadRequest('Invalid nonce token.')

        del login_session[key]
        if not ds.delete_item(item):
            raise BadRequest('Error deleting item.')

        return {'success': True}


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


