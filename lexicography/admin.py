from django.utils.html import escape, mark_safe
from django.core import urlresolvers
from django.contrib import admin
from .models import Entry, Chunk, ChangeRecord, UserAuthority, OtherAuthority, Authority

def make_link_method(field_name, display_name=None):
    if display_name is None:
        display_name = field_name
    def method(self, obj):
        field = getattr(obj, field_name)
        # pylint: disable-msg=W0212
        model_name = field._meta.module_name
        return mark_safe(u'<a href="%s">%s</a>' %
                         (urlresolvers.reverse("admin:lexicography_" +
                                               model_name + "_change",
                                               args=(field.c_hash, )),
                          escape(str(field))))
    method.allow_tags=True
    method.short_description=display_name
    return method

class EntryAdmin(admin.ModelAdmin):
    list_display = ('headword', 'user', 'datetime', 'session', 'ctype', 'csubtype', 'chunk_link')

    chunk_link = make_link_method('c_hash', "Chunk")

class ChangeRecordAdmin(admin.ModelAdmin):
    list_display = ('entry', 'headword', 'user', 'datetime', 'session', 'ctype', 'csubtype', 'chunk_link')

    chunk_link = make_link_method('c_hash', "Chunk")

admin.site.register(Entry, EntryAdmin)
admin.site.register(Chunk)
admin.site.register(ChangeRecord, ChangeRecordAdmin)
admin.site.register(UserAuthority)
admin.site.register(OtherAuthority)
admin.site.register(Authority)
