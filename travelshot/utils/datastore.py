'''
Contains utility functions
'''

from ..models import db
from ..models import User

# Data store operations
def create_user(dict_info):
    user = User(
        gplus_id=dict_info['gplus_id'],
        facebook_id=dict_info['facebook_id'],
        email=dict_info['email'],
        name=dict_info['name'],
        first_name=dict_info['first_name'],
        middle_name=dict_info['middle_name'],
        last_name=dict_info['last_name'],
        picture=dict_info['picture'],
        locale=dict_info['locale'],
        gender=dict_info['gender'],
        link=dict_info['link'],
        verified_email=dict_info['verified_email']
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