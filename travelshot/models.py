'''
Model definitions
'''

import datetime
from sqlalchemy.dialects import sqlite
from sqlalchemy.schema import CheckConstraint
from .lib.flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()

class User(db.Model):
    '''Represents a user'''
    __tablename__ = 'user'

    id = db.Column(db.BigInteger().with_variant(sqlite.INTEGER(), 'sqlite'), db.Sequence('user_id_seq'), primary_key=True)
    gplus_id = db.Column(db.String(80), unique=True, nullable=True)
    facebook_id = db.Column(db.String(80), unique=True, nullable=True)
    email = db.Column(db.String(80))              # Users can deny access to email address
    name = db.Column(db.String(240))
    first_name = db.Column(db.String(80))
    middle_name = db.Column(db.String(80))
    last_name = db.Column(db.String(80))
    picture = db.Column(db.String(500))
    locale = db.Column(db.String(10))
    gender = db.Column(db.String(10))
    link = db.Column(db.String(500))
    verified_email = db.Column(db.Boolean)

    __table_args__ = (CheckConstraint('(gplus_id IS NOT NULL) OR (facebook_id IS NOT NULL)', \
        name='gplus_fb_id_check'), )

    @property
    def serialize(self):
        """Return object data in easily serializable format"""
        return {
            'id': self.id,
            'gplus_id': self.gplus_id,
            'facebook_id': self.facebook_id,
            'email': self.email,
            'name': self.name,
            'first_name': self.first_name,
            'middle_name': self.middle_name,
            'last_name': self.last_name,
            'picture': self.picture,
            'locale': self.locale,
            'gender': self.gender,
            'link': self.link,
            'verified_email': self.verified_email
        }

class Category(db.Model):
    '''Represents a category'''
    __tablename__ = 'category'

    id = db.Column(db.Integer, db.Sequence('category_id_seq'), primary_key=True)
    name = db.Column(db.String(250), nullable=False)

    @property
    def serialize(self):
        """Return object data in easily serializable format"""
        return {
            'id': self.id,
            'name': self.name
        }

class Item(db.Model):
    '''Represents an item'''
    __tablename__ = 'item'

    id = db.Column(db.BigInteger().with_variant(sqlite.INTEGER(), 'sqlite'), db.Sequence('item_id_seq'), primary_key=True)
    title = db.Column(db.String(250))
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    description = db.Column(db.Text)
    author_id = db.Column(db.BigInteger().with_variant(sqlite.INTEGER(), 'sqlite'), db.ForeignKey('user.id'), nullable=False)
    date_created = db.Column(db.DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    last_modified = db.Column(db.DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    image_type = db.Column(db.String(5))
    salt = db.Column(db.String(32))
    category = db.relationship(Category)
    user = db.relationship(User)

    @property
    def serialize(self):
        """Return object data in easily serializable format"""
        return {
            'id': self.id,
            'title': self.title,
            'category_id': self.category_id,
            'description': self.description,
            'author_id': self.author_id,
            'date_created': self.date_created.isoformat(),
            'last_modified': self.last_modified.isoformat()
        }

