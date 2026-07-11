from app.core.database import Base
from app.models.user import User, UserPreference, UserEmbedding
from app.models.book import Book, Author, BookAuthor, Genre, BookGenre, BookEmbedding
from app.models.scan import BookScan
from app.models.interaction import UserBookInteraction
from app.models.recommendation import Recommendation

__all__ = [
    "Base",
    "User",
    "UserPreference",
    "UserEmbedding",
    "Book",
    "Author",
    "BookAuthor",
    "Genre",
    "BookGenre",
    "BookEmbedding",
    "BookScan",
    "UserBookInteraction",
    "Recommendation",
]
