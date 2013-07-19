define(function (require, exports, module) {
'use strict';

var Decorator = require("wed/decorator").Decorator;
var refmans = require("./btw_refmans");
var oop = require("wed/oop");
var $ = require("jquery");
var util = require("wed/util");
var jqutil = require("wed/jqutil");
var input_trigger = require("wed/input_trigger");
var key_constants = require("wed/key_constants");
var domutil = require("wed/domutil");
var Transformation = require("wed/transformation").Transformation;

function BTWDecorator(mode, meta) {
    Decorator.apply(this, Array.prototype.slice.call(arguments, 2));

    this._mode = mode;
    this._meta = meta;
    this._sense_refman = new refmans.SenseReferenceManager();
    this._example_refman = new refmans.SenseReferenceManager();
    this._section_heading_map = {
        "btw:definition": ["definition", null],
        "btw:sense": ["SENSE", this._getSenseLabel.bind(this)],
        "btw:english-renditions": ["English renditions", null],
        "btw:english-rendition": ["English rendition", null],
        "btw:semantic-fields": ["semantic categories", null],
        "btw:etymology": ["etymology", null],
        "btw:classical-renditions": ["classical renditions", null],
        "btw:modern-renditions": ["modern renditions", null],
        "btw:explanation": ["brief explanation of sense",
                            this._getSubsenseLabel.bind(this)],
        "btw:citations": ["selected citations for sense",
                            this._getSubsenseLabel.bind(this)]

    };
}

oop.inherit(BTWDecorator, Decorator);

BTWDecorator.prototype.init = function ($root) {
    var no_default_decoration = [
        util.classFromOriginalName("btw:entry"),
        util.classFromOriginalName("btw:lemma"),
        util.classFromOriginalName("btw:overview"),
        util.classFromOriginalName("btw:definition"),
        util.classFromOriginalName("btw:sense-discrimination"),
        util.classFromOriginalName("btw:sense"),
        util.classFromOriginalName("btw:subsense"),
        util.classFromOriginalName("btw:english-renditions"),
        util.classFromOriginalName("btw:english-rendition"),
        util.classFromOriginalName("term"),
        util.classFromOriginalName("btw:semantic-fields"),
        util.classFromOriginalName("btw:sf"),
        util.classFromOriginalName("btw:explanation"),
        util.classFromOriginalName("btw:citations"),
        util.classFromOriginalName("p"),
        util.classFromOriginalName("ptr"),
        util.classFromOriginalName("foreign"),
        util.classFromOriginalName("btw:renditions-and-discussions"),
        util.classFromOriginalName("btw:historico-semantical-data"),
        util.classFromOriginalName("btw:etymology"),
        util.classFromOriginalName("btw:classical-renditions"),
        util.classFromOriginalName("btw:modern-renditions"),
        util.classFromOriginalName("btw:lang"),
        util.classFromOriginalName("btw:occurrence"),
        util.classFromOriginalName("ref"),
        util.classFromOriginalName("btw:sense-emphasis")
    ].join(", ");

    this._domlistener.addHandler(
        "included-element",
        util.classFromOriginalName("*"),
        function ($root, $tree, $parent,
                  $prev, $next, $el) {
            // Skip elements which would already have been removed from
            // the tree. Unlikely but...
            if ($el.closest($root).length === 0)
                return;

            var klass = this._meta.getAdditionalClasses($el.get(0));
            if (klass.length > 0)
                $el.addClass(klass);

            var name = util.getOriginalName($el.get(0));
            switch(name) {
            case "btw:overview":
            case "btw:sense-discrimination":
            case "btw:renditions-and-discussions":
            case "btw:historico-semantical-data":
                unitHeadingDecorator($root, $el);
                break;
            case "btw:definition":
            case "btw:english-renditions":
            case "btw:english-rendition":
            case "btw:semantic-fields":
            case "btw:etymology":
                this.sectionHeadingDecorator($root, $el);
                break;
            case "btw:classical-renditions":
            case "btw:modern-renditions":
                this.sectionHeadingDecorator($root, $el);
                this.listDecorator($el.get(0), "; ");
                break;
            case "btw:lang":
                includedBTWLangHandler.apply(undefined, arguments);
                break;
            case "btw:sense":
                this.includedSenseHandler.apply(this, arguments);
                break;
            case "btw:subsense":
                this.includedSubsenseHandler.apply(this, arguments);
                break;
            case "ptr":
                this.ptrDecorator.apply(this, arguments);
                break;
            case "foreign":
                languageDecorator.apply(undefined, arguments);
                break;
            case "btw:authority":
                this.listDecorator($el.get(0), ", ");
                var target = $el.attr(util.encodeAttrName('target'));
                var label = target.split("/").slice(-1)[0];
                $el.prepend("<div class='_text _phantom'>" + label +
                            " </div>");
                break;
            case "ref":
                $el.children("._text._phantom._ref_paren").remove();
                if ($el.closest(
                    util.classFromOriginalName("btw:occurrence").length > 0)) {
                    $el.prepend("<div class='_text _phantom _ref_paren'>(</div>");
                    $el.append("<div class='_text _phantom _ref_paren'>)</div>");
                }
                break;
            case "btw:occurrence":
                $el.children("._text._phantom._occurrence_space").remove();
                var $ref = $el.children(util.classFromOriginalName("ref"));
                if ($ref.length > 0)
                    $ref.before("<div class='_text _phantom _occurrence_space'> </div>");
                break;
            default:
                if ($el.is(no_default_decoration))
                    return;
                this.elementDecorator($root, $el);
            }

            if (name === "btw:semantic-fields")
                this.listDecorator($el.get(0), "; ");
        }.bind(this));


    this._domlistener.addHandler(
        "children-changed",
        util.classFromOriginalName("*"),
        function ($root, $added, $removed, $prev, $next, $el) {
            if ($el.is(no_default_decoration))
                return;

            if ($added.is("._real, ._phantom_wrap") ||
                $removed.is("._real, ._phantom_wrap") ||
                $added.filter(jqutil.textFilter).length +
                $removed.filter(jqutil.textFilter).length > 0) {
                this.elementDecorator($root, $el);
                if (util.getOriginalName($el.get(0)) ===
                    "btw:semantic-fields")
                    this.listDecorator($el.get(0), "; ");
            }

        }.bind(this));

    this._domlistener.addHandler(
        "text-changed",
        util.classFromOriginalName("*"),
        function ($root, $el) {
            var $parent = $el.parent();
            if ($parent.is(no_default_decoration))
                return;

            this.elementDecorator($root, $parent);

            if (util.getOriginalName($parent.get(0)) === "btw:semantic-fields")
                this.listDecorator($parent.get(0), "; ");
        }.bind(this));


    this._domlistener.addHandler(
        "trigger",
        "included-sense",
        this.includedSenseTriggerHandler.bind(this));

    this._domlistener.addHandler(
        "trigger",
        "included-subsense",
        this.includedSubsenseTriggerHandler.bind(this));

    this._domlistener.addHandler(
        "trigger",
        "refresh-sense-ptrs",
        this.refreshSensePtrsHandler.bind(this));

    Decorator.prototype.init.apply(this, arguments);
    var p_input_trigger =
            new input_trigger.InputTrigger(this._editor,
                                           util.classFromOriginalName("p"));
    p_input_trigger.addKeyHandler(
        key_constants.ENTER,
        function (type, $el, ev) {
            // Prevent all further processing.
            if (ev)
                ev.stopImmediatePropagation();
            this._editor.fireTransformation(split_paragraph, $el.get(0));
        }.bind(this));

    p_input_trigger.addKeyHandler(
        key_constants.BACKSPACE,
        function (type, $el, ev) {
            var caret = this._editor.getDataCaret();
            // Fire it only if it the caret is at the start of the element
            // we are listening on and can't go back.
            if ((caret[1] === 0) &&
                (caret[0] === $el.get(0) ||
                 (caret[0].nodeType === Node.TEXT_NODE &&
                  caret[0] === $el.get(0).childNodes[0]))) {
                // Prevent all further processing.
                if (ev)
                    ev.stopImmediatePropagation();
                this._editor.fireTransformation(merge_paragraph_with_previous,
                                                $el.get(0));
            }
        }.bind(this));

    p_input_trigger.addKeyHandler(
        key_constants.DELETE,
        function (type, $el, ev) {
            var caret = this._editor.getDataCaret();
            // Fire it only if it the caret is at the end of the element
            // we are listening on and can't actually delete text.
            if ((caret[0] === $el.get(0) &&
                 caret[1] === $el.get(0).childNodes.length) ||
                (caret[0].nodeType === Node.TEXT_NODE &&
                 caret[0] === $el.get(0).lastChild &&
                 caret[1] === $el.get(0).lastChild.nodeValue.length)) {
                // Prevent all further processing.
                if (ev)
                    ev.stopImmediatePropagation();
                this._editor.fireTransformation(merge_paragraph_with_next,
                                                $el.get(0));
            }
        }.bind(this));
};

var split_paragraph = new Transformation(
    "Split paragraph",
    function (editor, node) {
        var caret = editor.getDataCaret();
        var pair = domutil.splitAt(node, caret[0], caret[1]);
        // Find the deepest location at the start of the 2nd
        // element.
        editor.setDataCaret(domutil.firstDescendantOrSelf(pair[1]),
                            0);
    });

var merge_paragraph_with_previous = new Transformation(
    "Merge paragraph with previous",
    function (editor, node) {

        var $node = $(node);
        var $prev = $node.prev();
        if ($prev.is(util.classFromOriginalName("p"))) {
            // We need to record these to set the caret to a good position.
            var caret_pos = $prev.get(0).childNodes.length;
            var was_text = $prev.get(0).lastChild.nodeType === Node.TEXT_NODE;
            var text_len = (was_text) ?
                    $prev.get(0).lastChild.nodeValue.length : 0;

            $prev.append($node.contents());

            // Normalize so that caret manipulations won't cause text
            // nodes to merge.
            $prev.get(0).normalize();

            if (was_text)
                editor.setDataCaret($prev.get(0).childNodes[caret_pos - 1],
                                    text_len);
            else
                editor.setDataCaret($prev.get(0), caret_pos);
            $node.detach();
        }
    });

var merge_paragraph_with_next = new Transformation(
    "Merge paragraph with next",
    function (editor, node) {

        var $node = $(node);
        var $next = $node.next();
        if ($next.is(util.classFromOriginalName("p")))
            merge_paragraph_with_previous.handler(editor, $next.get(0));
    });



BTWDecorator.prototype.elementDecorator = function ($root, $el) {
    Decorator.prototype.elementDecorator.call(
        this, $root, $el,
        util.eventHandler(this._contextMenuHandler.bind(this, true)),
        util.eventHandler(this._contextMenuHandler.bind(this, false)));
};

BTWDecorator.prototype._contextMenuHandler = function (at_start, ev, jQthis) {
    return false;
};

BTWDecorator.prototype.idDecorator = function (el) {
    var $el = $(el);
    var name = util.getOriginalName(el);
    var id = $el.attr(util.encodeAttrName("xml:id"));
    var wed_id = "BTW." + id;
    $el.attr("id", wed_id);
    var refman;
    switch(name) {
    case "btw:sense":
        refman = this._sense_refman;
        break;
    case "btw:subsense":
        refman = this._getSubsenseRefman(el);
        break;
    default:
        throw new Error("unknown element: " + name);
    }
    refman.allocateLabel(wed_id);
    this._domlistener.trigger("refresh-sense-ptrs");
};

BTWDecorator.prototype.refreshSensePtrsHandler = function ($root) {
    var dec = this;
    $root.find(util.classFromOriginalName("ptr")).each(function () {
        dec.linkingDecorator($root, $(this), true);
    });
};


BTWDecorator.prototype.includedSenseHandler = function (
    $root, $tree, $parent, $prev, $next, $el) {
    var id = $el.attr(util.encodeAttrName("xml:id"));
    if (id === undefined) {
        // Give it an id.
        id = this._sense_refman.nextNumber();
        $el.attr(util.encodeAttrName("xml:id"), "S." + id);
    }
    this._domlistener.trigger("included-sense");
};

BTWDecorator.prototype.includedSubsenseHandler = function (
    $root, $tree, $parent, $prev, $next, $el) {
    var id = $el.attr(util.encodeAttrName("xml:id"));
    if (id === undefined) {
        // Give it an id.
        var parent_wed_id = $parent.attr("id");
        var subsense_refman =
                this._sense_refman.idToSubsenseRefman(parent_wed_id);
        id = subsense_refman.nextNumber();
        $el.attr(util.encodeAttrName("xml:id"), parent_wed_id + "." + id);
    }
    this._domlistener.trigger("included-subsense");
};


BTWDecorator.prototype.includedSenseTriggerHandler = function ($root) {
    var dec = this;
    $root.find(util.classFromOriginalName("btw:sense")).each(function () {
        var $this = $(this);
        dec.idDecorator($this.get(0));
        dec.sectionHeadingDecorator($root, $this);
    });
};

BTWDecorator.prototype.includedSubsenseTriggerHandler = function ($root) {
    var dec = this;
    $root.find(util.classFromOriginalName("btw:subsense")).each(function () {
        var $subsense = $(this);
        dec.idDecorator($subsense.get(0));
        $subsense.children(util.classFromOriginalName("btw:explanation")).each(
            function () {
                var $this = $(this);
                $this.children("._phantom._text._explanation_number").remove();
                var refman = dec._getSubsenseRefman(this);
                var sublabel = refman.idToSublabel($subsense.attr("id"));
                $this.prepend("<div class='_phantom _text _explanation_number'>" + sublabel + ". </div>");
                dec.sectionHeadingDecorator($root, $this);
            });
        $subsense.children(util.classFromOriginalName("btw:citations")).each(
            function () {
                dec.sectionHeadingDecorator($root, $(this));
            });
    });
};

BTWDecorator.prototype._getSenseLabel = function (el) {
    var $el = $(el);
    var id = $el.attr("id");
    if (!id)
        throw new Error("element does not have an id: " + $el.get(0));
    return this._sense_refman.idToLabelForHead(id);
};

BTWDecorator.prototype._getSubsenseLabel = function (el) {
    var $el = $(el);
    var refman = this._getSubsenseRefman(el);

    var id = $el.parents().addBack().filter(
        util.classFromOriginalName("btw:subsense")).first().attr("id");
    if (!id)
        throw new Error("element that does not have subsense parent with "+
                        "an id: " + $el.get(0));
    var label = refman.idToLabelForHead(id);
    return label;
};

BTWDecorator.prototype._getSubsenseRefman = function (el) {
    var $el = $(el);
    var $parent =
            $el.parents(util.classFromOriginalName("btw:sense")).first();
    var parent_wed_id = $parent.attr("id");

    return this._sense_refman.idToSubsenseRefman(parent_wed_id);
};

BTWDecorator.prototype._getRefmanForElement = function ($root, $el) {
    var name = util.getOriginalName($el.get(0));
    switch(name) {
    case "ptr":
    case "ref":
        // Find the target and return its value

        // Slice to drop the #.
        var target_id = $el.attr(util.encodeAttrName("target")).slice(1);
        var $target = $root.find('[' + util.encodeAttrName("xml:id") + '="' +
                                 target_id + '"]');
        return ($target.length === 0) ? null :
            this._getRefmanForElement($root, $target);
    case "btw:sense":
        return this._sense_refman;
    case "btw:subsense":
        var $sense = $el.
            parents(util.classFromOriginalName("btw:sense")).first();
        var id = $sense.attr("id");
        return this._sense_refman.idToSubsenseRefman(id);
    case "btw:example":
        return this._example_refman;
    default:
        throw new Error("unexpected element: " + $el);
    }
};



// Override
BTWDecorator.prototype.contentDecoratorInclusionHandler = function ($root,
                                                                    $element) {
    var pair = this._mode.nodesAroundEditableContents($element.get(0));

    this._contentDecorator($root, $element, $(pair[0]), $(pair[1]));
};



function jQuery_escapeID(id) {
    return id.replace(/\./g, '\\.');
}

var next_head = 0;
function allocateHeadID() {
    return "BTW.H." + ++next_head;
}

var unit_heading_map = {
    "btw:overview": "UNIT 1: OVERVIEW",
    "btw:sense-discrimination": "UNIT 2: SENSE DISCRIMINATION",
    "btw:historico-semantical-data": "UNIT 3: HISTORICO-SEMANTICAL DATA",
    "btw:renditions-and-discussions": "UNIT 4: RENDITIONS AND DISCUSSIONS"
};

function unitHeadingDecorator($root, $el) {
    $el.children('.head').remove();
    var name = util.getOriginalName($el.get(0));
    var head = unit_heading_map[name];
    if (head === undefined)
        throw new Error("found an element with name " + name +
                        ", which is not handled");

    head = $('<div class="head _phantom">' + head + "</div>");
    head.attr('id', allocateHeadID());

    $el.prepend(head);
}

BTWDecorator.prototype.sectionHeadingDecorator = function ($root, $el, head) {
    $el.children('.head').remove();
    if (head === undefined) {
        var name = util.getOriginalName($el.get(0));
        var head_spec = this._section_heading_map[name];
        if (head_spec === undefined)
            throw new Error("found an element with name " + name +
                            ", which is not handled");
        var label_f = head_spec[1];
        head = (label_f) ? head_spec[0] + " " + label_f($el.get(0)) :
            head_spec[0];
    }

    head = $('<div class="head _phantom">[' + head + "]</div>");
    head.attr('id', allocateHeadID());

    $el.prepend(head);
};

/**
 * This function adds a separator between each child element of the
 * element passed as <code>el</code>. The function only considers
 * _real elements. This function accepts non-homogeneous lists.
 *
 */
function beforeListItemDecorator(el, child_name, sep) {
    // First drop all children that are separators
    $(el).children('[data-wed--separator-for]').remove();

    // If sep is a string, create an appropriate div.
    if (typeof sep === "string")
        sep = $('<div class="_text">' + sep + "</div>");

    $(sep).addClass('_phantom');
    $(sep).attr('data-wed--separator-for', child_name);

    var first = true;
    $(el).children('.' + child_name + '._real').each(function () {
        if (!first)
            $(this).before(sep.clone());
        else
            first = false;
    });
}

/**
 * This function adds a separator between each child element of the
 * element passed as <code>el</code>. The function only considers
 * _real elements. This function accepts non-homogeneous lists.
 *
 */
function heterogeneousListItemDecorator(el, sep) {
    // First drop all children that are separators
    $(el).children('[data-wed--separator-for]').remove();

    // If sep is a string, create an appropriate div.
    if (typeof sep === "string")
        sep = $('<div class="_text">' + sep + "</div>");

    $(sep).addClass('_phantom');

    var first = true;
    $(el).children('._real').each(function () {
        if (!first)
            $(this).before(sep.clone().attr('data-wed--separator-for',
                                            util.getOriginalName(el)));
        else
            first = false;
    });
}

BTWDecorator.prototype.linkingDecorator = function ($root, $el, is_ptr) {
    var orig_target = $.trim($el.attr(util.encodeAttrName("target")));
    if (orig_target === undefined)
        throw new Error("ptr element without target");

    // Add BTW in front because we want the target used by wed.
    var target = orig_target.replace(/#(.*)$/,'#BTW.$1');

    var $text = $('<div class="_text _phantom _linking_deco">');
    var $a = $("<a>", {"class": "_phantom", "href": target});
    $text.append($a);
    if (is_ptr) {
        // _linking_deco is used locally to make this function idempotent
        $el.children().remove("._linking_deco");
        var refman = this._getRefmanForElement($root, $el);

        // An undefined or null refman can happen when first
        // decorating the document.
        var label = refman && refman.idToLabel(target.slice(1));

        // Useful for debugging.
        if (label === undefined)
            label = target;

        if (refman) {
            if (refman.name === "sense" || refman.name === "subsense")
                $a.text("[" + label + "]");
            // XXX we need to deal with example references here.
        }
        else
            $a.text(label);

        // A ptr contains only attributes, no text, so we can just append.
        $el.append($text);

        // Find the referred element.
        var $target = $(jQuery_escapeID(target));
        if ($target.length > 0) {
            var target_name = util.getOriginalName($target.get(0));
            if (target_name === "btw:sense" ||  target_name === "btw:subsense")
                $target = $target.find(
                    util.classFromOriginalName("btw:explanation"));

            $target = $target.clone();
            $target.find(".head").remove();
            $target = $("<div/>").append($target);
            $text.tooltip({"title": $target.html(), "html": true, "container": "body"});
        }
    }
    else {
        $el.find("a").children().unwrap().unwrap();
        var inner_text = $('<div class="_real _text">');
        $a.append(inner_text);
        $el.contents().wrapAll($text);

        // Wrap all essentially creates a new element out of
        // text, so we have to find it again.
        $text = $el.children("._text._phantom");
        $text.tooltip({"title": "*** Place holder. Function not implemented yet. TODO.***",
                   "html": true, "container": "body"});
    }
};

BTWDecorator.prototype.ptrDecorator = function ($root, $tree, $parent,
                                                $prev, $next, $el) {
    this.linkingDecorator($root, $el, true);
};

BTWDecorator.prototype.refDecorator = function ($root, $tree, $parent,
                                                $prev, $next, $el) {
    this.linkingDecorator($root, $el, false);
};

var lang_to_label = {
    "sa-Latn": "Sanskrit; Skt",
    "pi-Latn": "Pāli; Pāli",
    "bo-Latn": "Tibetan; Tib",
    "zh-Hant": "Chinese; Ch",
    "x-gandhari-Latn": "Gāndhārī; Gāndh",
    "en": "English; Eng",
    "fr": "French; Fr",
    "de": "German; Ger",
    "it": "Italian; It",
    "es": "Spanish; Sp",
    // Additional languages
    "la": "Latin; Lat",
    "zh-Latn-pinyin": "Chinese Pinyin; Ch Pin",
    "x-bhs-Latn": "Buddhist Hybrid Sanskrit; BHSkt"
}

function languageDecorator($root, $tree, $parent, $prev, $next, $el) {
    var lang = $el.attr(util.encodeAttrName("xml:lang"));
    var prefix = lang.slice(0, 2);
    if (prefix !== "en") {
        $el.css("background-color", "#CCFF66");
        // Chinese is not commonly italicized.
        if (prefix !== "zh")
            $el.css("font-style", "italic");

        var label = lang_to_label[lang];
        if (label === undefined)
            throw new Error("unknown language: " + lang);
        label = label.split("; ")[0];
        $el.tooltip({"title": label, "container": "body"});
    }
}


function addedIdHandler($root, $parent, $previous_sibling, $next_sibling, $element) {
    var $parent = $element.parent();
    if ($parent.is(util.classFromOriginalName("sense"))) {
        var $start = $parent.children("._gui._start_button");
        $start.nextUntil($element).addBack().add($element).wrapAll("<span class='_gui _button_and_id _phantom'>");
    }
}

function includedBTWLangHandler($root, $tree, $parent, $prev, $next, $el) {
    var lang = $el.attr(util.encodeAttrName('btw:lang'));
    var label = lang_to_label[lang];
    if (label === undefined)
        throw new Error("unknown language: " + lang);
    // We want the abbreviation
    label = label.split("; ", 2)[1] + " ";
    $el.prepend("<div class='_text _phantom'>" + label + "</div>");
    heterogeneousListItemDecorator($el.get(0), ", ");
}

exports.BTWDecorator = BTWDecorator;

});
