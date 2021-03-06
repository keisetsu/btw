import re

from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium_test.btw_util import record_senses, record_renditions_for
from nose.tools import assert_equal, assert_is_none  # pylint: disable=E0611
from behave import then, when  # pylint: disable=E0611

from selenium_test import btw_util

sense_re = re.compile(r"sense (.)\b")


def senses_in_order(util):
    senses = btw_util.get_senses(util)
    label_ix = ord("A")
    for sense in senses:
        heads = sense.find_elements_by_class_name("head")
        for head in heads:
            text = head.text
            if text.startswith("[SENSE"):
                assert_equal(text, "[SENSE {0}]".format(chr(label_ix)),
                             "head text")
            elif "sense" in text:
                match = sense_re.search(text)
                assert_equal(match.group(1), chr(label_ix).lower(),
                             "subhead text")
        label_ix += 1


@record_senses
@then(u'sense {first} becomes sense {second}')
def step_impl(context, first, second):
    util = context.util

    initial_terms = context.initial_sense_terms
    first_ix = ord(first) - ord("A")
    second_ix = ord(second) - ord("A")

    terms = btw_util.get_sense_terms(util)

    assert_equal(initial_terms[first_ix], terms[second_ix],
                 "relative order of the senses")

    senses_in_order(util)


@record_senses
@then(u'sense {label} remains the same')
def step_impl(context, label):
    context.execute_steps(u"""
    Then sense {0} becomes sense {0}
    """.format(label))


@record_senses
@then(u'a new sense {label} is created')
def step_impl(context, label):
    util = context.util

    initial_terms = context.initial_sense_terms
    ix = ord(label) - ord("A")

    terms = btw_util.get_sense_terms(util)

    assert_equal(len(initial_terms) + 1, len(terms), "number of terms")
    assert_is_none(terms[ix], "the new sense has no term yet")


@when(u'the user undoes')
def step_impl(context):
    driver = context.driver
    util = context.util

    undo = util.find_clickable_element((By.CLASS_NAME, "icon-undo"))
    ActionChains(driver) \
        .click(undo) \
        .perform()


@record_senses
@then(u'the senses are the same as originally')
def step_impl(context):
    util = context.util
    senses_in_order(util)

    initial_terms = context.initial_sense_terms
    terms = btw_util.get_sense_terms(util)

    assert_equal(initial_terms, terms, "senses")


@record_renditions_for("A")
@then(u'the first english rendition becomes second')
def step_impl(context):
    util = context.util
    initial_renditions = context.initial_renditions_by_sense["A"]

    sense = btw_util.get_sense_by_label(util, "A")

    def cond(*_):
        renditions = btw_util.get_rendition_terms_for_sense(sense)
        return renditions if len(renditions) == len(initial_renditions) + 1 \
            else None

    renditions = util.wait(cond)

    assert_equal(initial_renditions[0], renditions[1], "renditions")


@record_renditions_for("A")
@then(u'a new first english rendition is created')
def step_impl(context):
    util = context.util

    initial_renditions = context.initial_renditions_by_sense["A"]
    sense = btw_util.get_sense_by_label(util, "A")
    renditions = btw_util.get_rendition_terms_for_sense(sense)
    assert_equal(len(renditions), len(initial_renditions) + 1, "length")
    assert_is_none(renditions[0], "first rendition is new")


@record_renditions_for("A")
@then(u'the first english rendition remains the same')
def step_impl(context):
    util = context.util
    initial_renditions = context.initial_renditions_by_sense["A"]

    sense = btw_util.get_sense_by_label(util, "A")

    def cond(*_):
        renditions = btw_util.get_rendition_terms_for_sense(sense)
        return renditions if len(renditions) == len(initial_renditions) + 1 \
            else None

    renditions = util.wait(cond)

    assert_equal(initial_renditions[0], renditions[0], "renditions")


@record_renditions_for("A")
@then("a new english rendition is created after the first")
def step_impl(context):
    util = context.util

    initial_renditions = context.initial_renditions_by_sense["A"]
    sense = btw_util.get_sense_by_label(util, "A")
    renditions = btw_util.get_rendition_terms_for_sense(sense)
    assert_equal(len(renditions), len(initial_renditions) + 1, "length")
    assert_is_none(renditions[1], "second rendition is new")
