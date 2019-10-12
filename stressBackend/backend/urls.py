from django.urls import path, include
from django.conf import settings
from django.contrib.auth import logout

from . import views
# from .views import oAuthView, oAuth2CallBackView, oAuthJavascriptView

urlpatterns = [
    path('', views.index, name='index'),
    path('processEvents/', views.postEvents, name='postEvents'),


    path('', include('social_django.urls', namespace='social')),
    path('logout/', logout, {'next_page': settings.LOGOUT_REDIRECT_URL},
         name='logout'),
    # path('', oAuthJavascriptView, name="login"),
    # path('auth/', oAuthView, name="auth"),
    # path('oauth2callback/', oAuth2CallBackView, name="oauth2callback"),
]
