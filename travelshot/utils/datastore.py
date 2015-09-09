'''
Contains utility functions
'''

from sqlalchemy.exc import IntegrityError

from ..models import db
from ..models import User
from ..models import Category
from ..models import Item

######### User ############
def create_user(dict_info):
    user = User(
        gplus_id=dict_info.get('gplus_id', None),
        facebook_id=dict_info.get('facebook_id', None),
        email=dict_info.get('email', None),
        name=dict_info.get('name', None),
        first_name=dict_info.get('first_name', None),
        middle_name=dict_info.get('middle_name', None),
        last_name=dict_info.get('last_name', None),
        picture=dict_info.get('picture', None),
        locale=dict_info.get('locale', None),
        gender=dict_info.get('gender', None),
        link=dict_info.get('link', None),
        verified_email=dict_info.get('verified_email', None)
        )
    try:
        db.session.add(user)
        db.session.commit()
    except IntegrityError:
        user = None
    return user

def get_user_by_id(user_id):
    return User.query.filter_by(id=user_id).first()

def get_user_by_facebook_id(facebook_id):
    return User.query.filter_by(facebook_id=facebook_id).first()

def get_user_by_gplus_id(gplus_id):
    return User.query.filter_by(gplus_id=gplus_id).first()

def find_user(fb_or_gplus_id):
    return get_user_by_facebook_id(fb_or_gplus_id) or get_user_by_gplus_id(fb_or_gplus_id)


######### Category ############
def new_category(title):
    cat = Category(name=title)

    try:
        db.session.add(cat)
        db.session.commit()
    except IntegrityError:
        cat = None
    return cat

def get_category_by_id(category_id):
    return Category.query.filter_by(id=category_id).first()

def get_category_by_id_or_404(category_id):
    return Category.query.filter_by(id=category_id).first_or_404()

def get_categories():
    return Category.query.all()


######### Items ############
def new_item(item_info):
    item = Item(
        title=item_info.get('title', None),
        category_id=item_info.get('category', None),
        description=item_info.get('description', None),
        image_type=item_info.get('image_type', None),
        author_id=item_info.get('author', None),
        salt=item_info.get('salt', None)
        )

    try:
        db.session.add(item)
        db.session.commit()
    except IntegrityError:
        item = None
    return item

def save_item(item):
    try:
        db.session.add(item)
        db.session.commit()
        return item
    except IntegrityError:
        return  None

def delete_item(item):
    try:
        db.session.delete(item)
        db.session.commit()
        return True
    except IntegrityError:
        return False

def get_item_by_id(item_id):
    return Item.query.filter_by(id=item_id).first()

def get_item_with_id_salt_type_or_404(item_id, salt, image_type):
    return Item.query.filter_by(id=item_id, salt=salt, image_type=image_type).first_or_404()

def get_latest_items(limit=24, offset=0):
    return Item.query.order_by(Item.date_created.desc()).offset(offset).limit(limit)

def get_items_by_author(author_id):
    return Item.query.filter_by(author_id=author_id).order_by(Item.date_created.desc()).all()

def get_items_for_category(category_id, limit=24, offset=0):
    return Item.query.filter_by(category_id=category_id).order_by(Item.date_created.desc()).offset(offset).limit(limit)

def get_all_items_for_category(category_id):
    return Item.query.filter_by(category_id=category_id).order_by(Item.date_created.desc()).all()
