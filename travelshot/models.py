'''
Model definitions
'''

import datetime

from sqlalchemy import Column
from sqlalchemy import ForeignKey
from sqlalchemy import Sequence

from sqlalchemy import BigInteger
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import DateTime
from sqlalchemy import Boolean
from sqlalchemy.dialects import sqlite

from sqlalchemy.orm import relationship

from .database import Base

class User(Base):
    '''Represents a user'''
    __tablename__ = 'user'

    id = Column(BigInteger().with_variant(sqlite.INTEGER(), 'sqlite'), Sequence('user_id_seq'), primary_key=True)
    gplus_id = Column(String(80))
    facebook_id = Column(String(80))
    email = Column(String(80))              # Users can deny access to their email address
    name = Column(String(240))
    given_name = Column(String(80))
    middle_name = Column(String(80))
    family_name = Column(String(80))
    picture = Column(String(500))
    locale = Column(String(10))
    gender = Column(String(10))
    link = Column(String(500))
    verified_email = Column(Boolean)

    @property
    def serialize(self):
        """Return object data in easily serializable format"""
        return {
            'id': self.id,
            'gplus_id': self.gplus_id,
            'facebook_id': self.facebook_id,
            'email': self.email,
            'name': self.email,
            'given_name': self.given_name,
            'middle_name': self.middle_name,
            'family_name': self.family_name,
            'picture': self.picture,
            'locale': self.locale,
            'gender': self.gender,
            'link': self.link,
            'verified_email': self.verified_email
        }

class Category(Base):
    '''Represents a category'''
    __tablename__ = 'category'

    id = Column(Integer, Sequence('category_id_seq'), primary_key=True)
    name = Column(String(250), nullable=False)

    @property
    def serialize(self):
        """Return object data in easily serializable format"""
        return {
            'id': self.id,
            'name': self.name
        }

class Item(Base):
    '''Represents an item'''
    __tablename__ = 'item'

    id = Column(BigInteger().with_variant(sqlite.INTEGER(), 'sqlite'), Sequence('item_id_seq'), primary_key=True)
    title = Column(String(250))
    category_id = Column(Integer, ForeignKey('category.id'), nullable=False)
    description = Column(Text)
    author_id = Column(BigInteger().with_variant(sqlite.INTEGER(), 'sqlite'), ForeignKey('user.id'), nullable=False)
    date_created = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    last_modified = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    category = relationship(Category)
    user = relationship(User)

    @property
    def serialize(self):
        """Return object data in easily serializable format"""
        return {
            'id': self.id,
            'title': self.title,
            'category_id': self.category_id,
            'description': self.description,
            'author_id': self.author_id,
            'date_created': self.date_created,
            'last_modified': self.last_modified
        }

