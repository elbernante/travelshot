'''
Contains utility functions
'''

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
    db.session.add(user)
    db.session.commit()
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
    db.session.add(cat)
    db.session.commit()
    return cat

def get_categories():
    return Category.query().all();


######### Items ############
def new_item(item_info):
    item = Item(
        title=item_info.get('title', None),
        category_id=item_info.get('category', None),
        description=item_info.get('description', None),
        image_type=item_info.get('image_type', None),
        author_id=item_info.get('author', None)
        )
    db.session.add(item)
    db.session.commit()
    return item
