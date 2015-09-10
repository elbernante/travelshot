'''
Contains functions for querying the database.
'''

from sqlalchemy.exc import IntegrityError

from ..models import db
from ..models import User
from ..models import Category
from ..models import Item

######### User ############
def create_user(dict_info):
    '''Creates a new user in the database.

    Parameters:
        dict_info - Required. Dictionary. A dictionary containing necessary
                        information to create a user.
    Returns: User object or None if an error occured.
    '''

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
    '''Returns the user with the specified id.

    Parameters:
        user_id - Required. Integer. The ID of the user to be quired.

    Returns: User object or None if user_id does not exists.
    '''

    return User.query.filter_by(id=user_id).first()


def get_user_by_facebook_id(facebook_id):
    '''Returns the user with the Facebook id.

    Parameters:
        facebook_id - Required. String. The Facebook ID of the user to be
                        quiried.

    Returns: User object or None if user_id does not exists.
    '''

    return User.query.filter_by(facebook_id=facebook_id).first()


def get_user_by_gplus_id(gplus_id):
    '''Returns the user with the G Plus id.

    Parameters:
        gplus_id - Required. String. The G Plus ID of the user to be quiried.

    Returns: User object or None if user_id does not exists.
    '''

    return User.query.filter_by(gplus_id=gplus_id).first()


def find_user(fb_or_gplus_id):
    '''Returns the user with the Facebook or G Plus id. Queries by facebook ID
    first then by G Plus ID.

    Parameters:
        fb_or_gplus_id - Required. String. The Facebook or G Plus ID of the user
                            to be quiried.

    Returns: User object or None if user_id does not exists.
    '''

    return get_user_by_facebook_id(fb_or_gplus_id) \
        or get_user_by_gplus_id(fb_or_gplus_id)


######### Category ############
def new_category(title):
    '''Creates a new category in the database.

    Parameters:
        title - Required. String. Title for the new category.

    Returns: Category object or None if an error occured.
    '''

    cat = Category(name=title)

    try:
        db.session.add(cat)
        db.session.commit()
    except IntegrityError:
        cat = None
    return cat


def get_category_by_id(category_id):
    '''Returns the category with the specified category ID.

    Parameters:
        category_id - Required. Integer. ID of the category.

    Returns: Category object or None if category_id does not exists.
    '''

    return Category.query.filter_by(id=category_id).first()


def get_category_by_id_or_404(category_id):
    '''Returns the category with the specified category ID. Raises a 404
    exception if category ID does not exists.

    Parameters:
        category_id - Required. Integer. ID of the category.

    Returns: Category object or raises NotFound error if category_id does not
                exists.
    '''

    return Category.query.filter_by(id=category_id).first_or_404()


def get_categories():
    '''Returns all categories in the database.

    Returns: Array of Category objects.
    '''
    return Category.query.all()


######### Items ############
def new_item(item_info):
    '''Creates a new item in the database.

    Parameters:
        item_info - Required. Dictionary. A dictionary containing necessary
                        information to create an item.
    Returns: Item object or None if an error occured.
    '''

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
    '''Updates an existing item in the database.

    Parameters:
        item - Required. Item object. The item containing new values to be
                    saved. The item should already be existing in the database.

    Returns: Item object with the updated values, or None if an error occured.
    '''

    try:
        db.session.add(item)
        db.session.commit()
        return item
    except IntegrityError:
        return  None


def delete_item(item):
    '''Deletes an existing item from the database.

    Parameters:
        item - Required. Item object. The item to be deleted.

    Returns: True if deletion is successful, False otherwise.
    '''

    try:
        db.session.delete(item)
        db.session.commit()
        return True
    except IntegrityError:
        return False


def get_item_by_id(item_id):
    '''Returns the item with the specified ID.

    Parameters:
        item_id - Required. Integer. The ID of the item.

    Returns: Item object or None if item_id does not exists.
    '''

    return Item.query.filter_by(id=item_id).first()


def get_item_with_keys_or_404(item_id, salt, image_type):
    '''Returns the item with the specified item id, salt, and image type.

    item_id, salt, and image_type must match with the target item.

    Parameters:
        item_id    - Required. Integer. The ID of the item.
        salt       - Required. String. The salt key generated when the item was
                        created (or when the image of the item was updated).
        image_type - Required. String. The file extension of the image of the
                        item.

    Returns: Item object or raises a NotFound error if no match was found.
    '''

    return Item.query.filter_by(id=item_id, salt=salt, image_type=image_type)\
                .first_or_404()


def get_latest_items(limit=24, offset=0):
    '''Returns the most recent items, ordered by created date.

    Recent items are based on created date, not on updated date.

    Parameters:
        limit - Optional. Integer. Maximum number items to be returned. Defaults
                    to 24.
        offset - Optional. Integer. Index of the first item to be returned.
                    Defaults to 0.
    Returns: Array of item objects.
    '''

    return Item.query.order_by(Item.date_created.desc())\
                .offset(offset).limit(limit)


def get_items_by_author(author_id):
    '''Returns all the items created by the specified user.

    The items are ordered by most recently created.

    Parameters:
        author_id - Required. Integer. The ID of the user.

    Returns: Array of item objects.
    '''

    return Item.query.filter_by(author_id=author_id)\
                .order_by(Item.date_created.desc()).all()


def get_items_for_category(category_id, limit=24, offset=0):
    '''Returns the items of the specified category.

    The items are ordered by most recently created.

    Parameters:
        category_id - Required. Integer. The ID of the category.
        limit - Optional. Integer. Maximum number items to be returned. Defaults
                    to 24.
        offset - Optional. Integer. Index of the first item to be returned.
                    Defaults to 0.

    Returns: Array of item objects.
    '''

    return Item.query.filter_by(category_id=category_id)\
                .order_by(Item.date_created.desc()).offset(offset).limit(limit)


def get_all_items_for_category(category_id):
    '''Returns all items of the specified category.

    The items are ordered by most recently created.

    Parameters:
        category_id - Required. Integer. The ID of the category.

    Returns: Array of item objects.
    '''

    return Item.query.filter_by(category_id=category_id)\
                .order_by(Item.date_created.desc()).all()
