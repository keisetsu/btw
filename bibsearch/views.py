# django imports
from django.conf import settings
from django.http import HttpResponse, HttpResponseRedirect, \
    HttpResponseServerError, HttpResponseBadRequest
from django.template import Context, loader, RequestContext
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.views.decorators.http import require_POST, require_GET

# python imports
import urllib
import logging
from functools import wraps


# module imports
from .utils import Zotero, zotero_settings
from .models import ZoteroUser
from .forms import SearchForm

logger = logging.getLogger(__name__)


def ajax_login_required(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated():
            raise PermissionDenied
        return view(request, *args, **kwargs)
    return wrapper


@ajax_login_required
@require_GET
def search(request):
    try:
        ZoteroUser.objects.get(btw_user=request.user)
    except ObjectDoesNotExist:
        return HttpResponseServerError("users local profile not created.")

    # present a unbound form.
    form = SearchForm()
    template = loader.get_template('bibsearch/search.html')
    context = RequestContext(request, {'form': form})
    return HttpResponse(template.render(context))


@ajax_login_required
@require_POST
def exec_(request):
    if not request.is_ajax():
        return HttpResponseBadRequest()
    try:
        local_profile_object = ZoteroUser.objects.get(btw_user=request.user)
    except ObjectDoesNotExist:
        return HttpResponseServerError(
            "the user does not have a bibsearch profile.")

    # 1. from POST dictionary prepare:
    # a. the zotero library to search info from.
    # b. the keyword to search zotero for.

    # 2. perform search
    # a. see if the search got modified for the field
    # b. if not fetch from cache.
    # c. if modified fetch from zotero, reset key in cache
    # d. if result doesnot exist in cache forcefully fetch.

    query_dict = request.POST

    if 'library' not in query_dict or 'keyword' not in query_dict:
        return HttpResponseServerError("cannot interpret form data.")

    local_api_dict = {'uid': local_profile_object.uid, 'api_key':
                      local_profile_object.api_key}

    results_list = []
    extra_data = {}
    try:
        if int(query_dict['library']) in (2, 3):
            # evaluate the results from local account
            l_obj = Zotero(local_api_dict, "User Library")

            search_url = l_obj.getSearchUrl(query_dict['keyword'])
            logger.debug("searching url: %s", search_url)
            search_results, extra_vars = l_obj.getSearchResults(
                search_url)
            # update data
            results_list.extend(search_results)
            extra_data.update(extra_vars)

        if int(query_dict['library']) in (1, 3):
            # evaluate the results from the global account
            g_obj = Zotero(zotero_settings(), 'BTW Library')

            search_url = g_obj.getSearchUrl(query_dict['keyword'])
            logger.debug("searching url: %s", search_url)
            search_results, extra_vars = g_obj.getSearchResults(
                search_url)

            # update data
            results_list.extend(search_results)
            extra_data.update(extra_vars)

    except ValueError:
        return HttpResponseServerError("Malformed form data.")

    # append the results_list to the user's session
    # as the keyword changes, the result changes
    # when user's session is invalidated, the data too is cleaned.
    request.session['results_list'] = results_list
    request.session['extra_data'] = extra_data
    logger.debug("ajax update fired")

    # redirect to pagination url for returning the results first time.
    return HttpResponseRedirect('/search/results/')


@ajax_login_required
@require_GET
def results(request):
    """ pagination logic for the search results """

    results_list = request.session.get('results_list')
    extra_data = request.session.get('extra_data')

    if type(results_list) is list:
        logger.debug("start paginating the results")
        paginator = Paginator(results_list, settings.BIBSEARCH_PAGINATION_SIZE)
        page = request.GET.get('page')
        try:
            results = paginator.page(page)
        except PageNotAnInteger:
            # If page is not an integer, deliver first page.
            results = paginator.page(1)
        except EmptyPage:
            # If page is out of range (e.g. 999), deliver last page of results.
            results = paginator.page(paginator.num_pages)

        template = loader.get_template('bibsearch/results.html')
        context = Context({
            'results': results,
            'extras': extra_data,
        })
        return HttpResponse(template.render(context))

    return HttpResponseServerError('Search error.')


@ajax_login_required
@require_GET
def abbrev(request, itemKey):
    zotero = Zotero(zotero_settings(), "BTW Library")
    item = zotero.getItem(itemKey)
    ret = None

    creators = item.get("creators", None)
    if creators is not None:
        first = creators[0]
        ret = first.get("lastName", first.get("firstName", None))

    if ret is None:
        ret = "***ITEM HAS NO AUTHORS***"
    return HttpResponse(ret)


@ajax_login_required
@require_GET
def info(request, itemKey):
    pass


@ajax_login_required
@require_POST
def sync(request):
    """ Sync the given json string to BTW project.

    Sync has two steps :
    1) search (Item type, title ) if not with BTW project
    2) sync(write) if new item otherwise,
    3) mark it duplicate."""

    results_list = request.session.get('results_list')
    enc_string = request.POST.get('enc')

    if type(enc_string) is unicode and type(results_list) is list:
        data_dict = None
        for result in results_list:
            if 'itemKey' in result and result['itemKey'] == enc_string:
                data_dict = result
                break

        else:
            if len(enc_string) == 0:
                return HttpResponseServerError(
                    "Error: malformed data cannot be copied.")
            return HttpResponse(
                "Error: Item not in result database.")

        title = data_dict.get('title')
        item_type = data_dict.get('itemType')

        # search for duplicate
        sync_obj = Zotero(zotero_settings(), "BTW Library")
        search_url = sync_obj.dupSearchUrl(urllib.quote(title.lower()
                                                        ), item_type)

        logger.debug("searching duplicates from url: %s", search_url)

        search_results, extras = sync_obj.getSearchResults(search_url)

        dup_results = sync_obj.duplicateDrillDown(
            search_results, data_dict)

        if len(dup_results) == 0:
            local_profile_object = ZoteroUser.objects.get(
                btw_user=request.user)
            if item_type == u'attachment':
                # call setAttachment
                res = sync_obj.setAttachment(data_dict,
                                             local_profile_object)

            else:
                # call setItem
                res = sync_obj.setItem(data_dict)

            # do additional steps to manipulate bibsearch_sync_status to 0
            if res == "OK":
                extra_dict = request.session.pop('extra_data')
                if enc_string in extra_dict:
                    extra_dict[enc_string]['sync_status'] = 0
                # restore the extra dictionary
                request.session['extra_data'] = extra_dict

            return HttpResponse(res)

        else:
            extra_dict = request.session.pop('extra_data')
            if enc_string in extra_dict:
                extra_dict[enc_string]['sync_status'] = 1
            # restore the extra dictionary
            request.session['extra_data'] = extra_dict

            return HttpResponse("DUP")

    return HttpResponseServerError("ERROR: sync data i/o error.")


@require_GET
def testjs(request):
    """ Qunit tests view """
    template = loader.get_template('bibsearch/Qtests.html')
    context = RequestContext(request)
    return HttpResponse(template.render(context))
