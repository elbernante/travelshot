'''
ATOM Feed Module
Contains routes for feeds in Atom format
'''

from urlparse import urljoin
from flask import request
from flask import url_for
from werkzeug.contrib.atom import AtomFeed

from flask import Blueprint


from ..utils import util
from ..utils import datastore as ds

atom = Blueprint('atom', __name__)

@atom.route('/')
def index():
    '''Test route'''
    return 'Hello World! atom'


def make_external(url):
    return urljoin(request.url_root, url)

def make_content(sItem):
    return '<img src="{}" style="max-width: 60px; display:inline-block; float: left;"><p style="margin: 0px 5px 0px 70px;">{}</p>'\
        .format(make_external(sItem['image_url']), sItem['description'])

def make_feed(title):
    return AtomFeed(
        title,
        feed_url=request.url,
        url=request.url_root,
        icon=make_external(url_for('static', filename='faveicon.ico')),
        logo=make_external(url_for('static', filename='travelshot-logo-orange.png'))
    )

def add_items_to_feed(feed, items):
    for item in items:
        sItem = util.serialize_item_object(item)
        feed.add(
            title=item.title or 'No title',
            content=make_content(sItem),
            content_type='html',
            author=sItem['author']['name'],
            url=make_external(url_for('pages.view_item', item_id=item.id)),
            updated=item.last_modified,
            published=item.date_created
        )

@atom.route('/latestitems.atom')
def latest_items():
    feed = make_feed('Travel Shot')
    items = ds.get_latest_items(limit=15)
    add_items_to_feed(feed, items)
    return feed.get_response()

@atom.route('/category/<int:category_id>/latestitems.atom')
def latest_category_items(category_id):
    category = ds.get_category_by_id_or_404(category_id)
    feed = make_feed('Travel Shot: {}'.format(category.name))
    items = ds.get_items_for_category(category_id)
    add_items_to_feed(feed, items)
    return feed.get_response()
