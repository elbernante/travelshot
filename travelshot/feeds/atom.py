'''
ATOM Feed Module
Defines end points for feeds in Atom format.

The users can subscribe to either over all latest items or latest items for each
category.

The feeds are in Atom format.
'''

try:
    from urlparse import urljoin
except ImportError:
    # python 3
    from urllib.parse import urljoin

from flask import request
from flask import url_for
from werkzeug.contrib.atom import AtomFeed

from flask import Blueprint

from ..utils import util
from ..utils import datastore as ds

atom = Blueprint('atom', __name__)

def make_external(url):
    '''Prepends the URL with the root URL to be compatible in feed clients.'''

    return urljoin(request.url_root, url)


def make_content(s_item):
    '''Generates an HTML content for the feed entry. Will show the image and
    the description of the item.
    '''

    return '<img src="{}" style="max-width: 60px; display:inline-block; \
        float: left;"><p style="margin: 0px 5px 0px 70px;">{}</p>'\
        .format(make_external(s_item['image_url']), s_item['description'])


def make_feed(title):
    '''Creates an instance of AtomFeed with the givin title.'''

    return AtomFeed(
        title,
        feed_url=request.url,
        url=request.url_root,
        icon=make_external(url_for('static', \
            filename='faveicon.ico')),
        logo=make_external(url_for('static', \
            filename='travelshot-logo-orange.png'))
    )


def add_items_to_feed(feed, items):
    '''Add each item in items as entry to the feed.'''

    for item in items:
        s_item = util.serialize_item_object(item)
        feed.add(
            title=item.title or 'No title',
            content=make_content(s_item),
            content_type='html',
            author=s_item['author']['name'],
            url=make_external(url_for('pages.view_item', item_id=item.id)),
            updated=item.last_modified,
            published=item.date_created
        )


@atom.route('/latestitems.atom')
def latest_items():
    '''Allows the users to subscribe to latest items.

    Returns: A feed with 15 most recent items.
    '''

    feed = make_feed('Travel Shot')
    items = ds.get_latest_items(limit=15)
    add_items_to_feed(feed, items)
    return feed.get_response()


@atom.route('/category/<int:category_id>/latestitems.atom')
def latest_category_items(category_id):
    '''Allws to users to subscribe to latest items per category.

    Parameters:
        category_id - Required. Integer. The ID of the category to subscribe.

    Returns: A feed with 15 most recent items of the specified category. Raises
                a NotFound error if category_id does not exists.
    '''

    category = ds.get_category_by_id_or_404(category_id)
    feed = make_feed('Travel Shot: {}'.format(category.name))
    items = ds.get_items_for_category(category_id, limit=15)
    add_items_to_feed(feed, items)
    return feed.get_response()
