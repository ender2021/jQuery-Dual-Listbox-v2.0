/*
*       Developed by Justin Mead
*       ©2011 MeadMiracle
*		www.meadmiracle.com / meadmiracle@gmail.com
*       Version 1.3
*       Testing: IE8/Windows XP
*                Firefox/Windows XP
*                Chrome/Windows XP
*       Licensed under the Creative Commons GPL http://creativecommons.org/licenses/GPL/2.0/
*
*/
(function($) {
    
    //a quick internal plug-in to turn off selection of text
    $.fn.extend({ 
        disableSelection : function() { 
                return this.each(function() { 
                        this.onselectstart = function() { return false; }; 
                        this.unselectable = "on"; 
                        $(this).css('-moz-user-select', 'none'); 
                }); 
        } 
    });

    function DualListBox(){};
    function DlbItem(){};
    function DlbFilter() {};
    
    var _boxes = [],
        _buttons = function() {
            return $('<div />', { 'class': 'buttons-wrapper'})
                   .append($('<a />', { href: '#', 'class': 'select-item button' })
                        .append($('<span />', { 'class': 'rightarrow icon' }))
                        .append($('<span />', { 'class': 'btn-text' })
                            .text('Select Item(s)')))
                   .append($('<a />', { href: '#', 'class': 'select-all-items button' })
                        .append($('<span />', { 'class': 'dblrightarrow icon' }))
                        .append($('<span />', { 'class': 'btn-text' })
                            .text('Select All')))
                   .append($('<a />', { href: '#', 'class': 'exchange-items button' })
                        .append($('<span />', { 'class': 'exchange icon' }))
                        .append($('<span />', { 'class': 'btn-text' })
                            .text('Exchange Items')))
                   .append($('<a />', { href: '#', 'class': 'unselect-all-items button' })
                        .append($('<span />', { 'class': 'dblleftarrow icon' }))
                        .append($('<span />', { 'class': 'btn-text' })
                            .text('Deselect All')))
                   .append($('<a />', { href: '#', 'class': 'unselect-item button' })
                        .append($('<span />', { 'class': 'leftarrow icon' }))
                        .append($('<span />', { 'class': 'btn-text' })
                            .text('Deselect Item(s)')));
        },
        _fatalError = function(message) {
            alert(message);
        },
        _makeActive = function(elem, multiActive) {
            var classStrs = ['last-active', 'active'],
                addClass = _mergeClassStrs(classStrs);
            if (multiActive) { classStrs.pop(); }
            var selector = _mergeClassStrs(classStrs, 'li.', ','),
                removeClass =  _mergeClassStrs(classStrs);
            $(elem).parent().children(selector).removeClass(removeClass);
            $(elem).addClass(addClass);
        },
        _makeRangeActive = function(a, z, elems) {
            elems.filter('li.active').removeClass('active');
            if (a < z) {
                elems.slice(a, z + 1).addClass('active');
            } else if (a > z) {
                elems.slice(z, a + 1).addClass('active');
            } else {
                //deselect...our work is done
            }
        },
        _mergeClassStrs = function(arr, prefix, seperator) {
            if (!seperator) seperator = ' ';
            var p = '', toReturn = '';
            if (prefix) p = prefix;
            $.each(arr, function() {
                toReturn += p + this + seperator;
            });
            return $.trim(toReturn);
        };

    DualListBox.prototype = {
        init: function(target, options) {
            //first things first, make sure we're working on a select
            if ( target.nodeName.toLowerCase() != 'select') {
                //FAILURE!
                return _fatalError("dualListBox must be called on a <select> element. Initialization failed!");
            }
            var self = this;

            //merge user options into the defaults
            this._options = $.extend(true, {}, this._defaultOptions, options);

            this.items = [];

            // save the instance
            _boxes.push(this);

            // save the target here
            this._target = $(target);
            
            //create the dual list box construct
            this._container = $('<div />', { 'class': 'dlb-container',
                                             id: target.id + '-dlb-container' })
                             .append(this._wrapperTemplate('unselected-wrapper'))
                             .append(_buttons)
                             .append(this._wrapperTemplate('selected-wrapper'));
                              
            //create dimensions from those of the original
            $('ul', this._container).css({
                height: this._target.height(),
                width: this._target.width()
            });
            $('.group-wrapper', this._container).css({
                height: this._magicNumbers('group-wrapper-height'),
                width: this._magicNumbers('group-wrapper-width')
            });
            $('.select-item', this._container).css(
                'margin-top', this._magicNumbers('select-item-margin-top')
            );
            $('.filter-input', this._container).css(
                'width', this._magicNumbers('filter-input-width')
            );
            
            //save references to the lists
            this._unselected = $('.unselected-wrapper', this._container);
            this._selected = $('.selected-wrapper', this._container);
            
            //let's build some lists...
            this._itemsFromJsonArr(this._options.dataSource);
            this._itemsFromOptions($('option', this._target));
            
            //sort the items
            this.items.sort(this._options.sort);
            
            //place the items
            $.each(this.items, function(i) { this.place(i); });
            
            // hide the targeted element and insert the new construct
            $(this._target).hide().after(this._container);
            
            //create counters
            this._updateCounters();
            
            //attach submit handler
            $(this._container).closest('form').submit(function(event) {
                return self._options.submit.apply(this._container, event);
            });
            
            //attach click handler
            $(this._container).delegate('li', 'mousedown', function(e) {
                $(this).focus();
                if(e.ctrlKey) { 
                    _makeActive(this, true);
                } else if(e.shiftKey) { 
                    var start = $(this).parent().children('.last-active');
                    if (!start.size()) {
                        _makeActive(this);
                    } else {
                        var items = $(this).siblings().andSelf(),
                            a = $.inArray(start.get(0), items.get()),
                            z = $.inArray(this, items.get());
                        _makeRangeActive(a, z, items);
                    }
                } else {
                    _makeActive(this);
                }
            });
            
            //attach double click handler
            $(this._container).delegate('li', 'dblclick', function() {
                var item = self.items[$(this).data('index')];
                if (item.selected) {
                    item.unselect();
                } else {
                    item.select();
                }
                self._updateCounters();
            });
            
            //attach select active handler
            $('.select-item', this._container).click(function(e) {
                e.preventDefault();
                self._unselected.find('.item-list .active').each(function() {
                    self.items[$(this).data('index')].select();
                });
                self._updateCounters();
            });
            
            //attach unselect active handler
            $('.unselect-item', this._container).click(function(e) {
                e.preventDefault();
                self._selected.find('.item-list .active').each(function() {
                    self.items[$(this).data('index')].unselect();
                });
                self._updateCounters();
            });
            
            //attach select all handler
            $('.select-all-items', this._container).click(function(e) {
                e.preventDefault();
                self._unselected.find('.item-list *').each(function() {
                    self.items[$(this).data('index')].select();
                });
                self._updateCounters();
            });
            
            //attach unselect all handler
            $('.unselect-all-items', this._container).click(function(e) {
                e.preventDefault();
                self._selected.find('.item-list *').each(function() {
                    self.items[$(this).data('index')].unselect();
                });
                self._updateCounters();
            });
            
            //attach exchange handler
            $('.exchange-items', this._container).click(function(e) {
                e.preventDefault();
                $.each(self.items, function() {
                    if (this.selected) {
                        this.unselect();
                    } else {
                        this.select();
                    };
                });
                self._updateCounters();
            });
            
            $('li').focusin(function() { alert('hi!'); });
            
            //create filters
            this._unselectedFilter = new DlbFilter();
            this._unselectedFilter.init({
                instance: self,
                input: $('.filter-input', this._unselected),
                clear: $('.filter-clear', this._unselected),
                targetList: this._unselected
            });
            
            if (this._options.filter) {
                this._selectedFilter = new DlbFilter();
                this._selectedFilter.init({
                    instance: self,
                    input: $('.filter-input', this._selected),
                    clear: $('.filter-clear', this._selected),
                    targetList: this._selected
                });
            }
        },
        destroy: function() {
            this._container.remove();
            this._target.show();
        },
        get: function(index) {
            return _boxes[index];
        },
        _defaultOptions: {
            mode: 'move',
            sort: function(a, b) {
                var aVal = a.text.toLowerCase(),
                    bVal = b.text.toLowerCase();
                if (aVal < bVal) { return -1; }
                if (aVal > bVal) { return 1; }
                return 0;
            },
            submit: function(event) {
                return true;
            },
            filter: function(elem, filterString) {
                return $(elem).text().toString().toLowerCase()
                              .indexOf(filterString.toLowerCase()) == -1;
            },
            counter: function(visibleCount, totalCount) {
                return 'Showing ' + visibleCount + ' of ' + totalCount;
            },
            dataSource: []
        },
        _itemsFromJsonArr: function(arr) {
            if (arr.length) {
                var self = this;
                $.each(arr, function() {
                    var selected = "selected" in this ? this.selected : false,
                        x = new DlbItem();
                    x.init({
                        value: this.value,
                        text: this.text,
                        selected: selected,
                        instance: self
                    });
                    self.items.push(x);
                });
            }
        },
        _itemsFromOptions: function(opts) {
            if (opts.size()) {
                var self = this;
                opts.each(function() {
                    var x = new DlbItem();
                    x.init({
                        instance: self,
                        option: this
                    });
                    self.items.push(x);
                });
            }
        },
        _magicNumbers: function(number) {
            switch (number) {
                case 'group-wrapper-height':
                    var magicNum = this._options.filter ? 34 : 2;
                    return this._target.height() + magicNum;
                    break;
                case 'group-wrapper-width':
                    return this._target.width() + 2;
                    break;
                case 'select-item-margin-top':
                    var magicNum = this._options.filter ? 45 : 75;
                    return this._target.height() / 2 - magicNum;
                    break;
                case 'filter-input-width':
                    return this._target.width() - 36;
                    break;
                default:
                    return 0;
                    break;
            };
        },
        _wrapperTemplate: function(wrapperClass) {
            var box = $('<ul />', { 'class' : 'item-list' }),
                counter = $('<span />', { 'class': 'item-counter'}),
                groupWrapper = $('<div />', { 'class': 'group-wrapper ' + wrapperClass });
            if (this._options.filter) {
                var filterWrapper = $('<div />', { 'class' : 'filter-wrapper' }),
                    filterInput = $('<input />', { type: 'text',
                                                  'class': 'filter-input',
                                                   placeholder: 'Filter'
                                  }),
                    filterClear = $('<a />', { href: '#', 'class': 'filter-clear button' })
                        .append($('<span />', { 'class': 'cross icon' }))
                            .append($('<span />', { 'class': 'btn-text' })
                                .text('X'));                
                filterWrapper.append(filterInput).append(filterClear);
                groupWrapper.append(filterWrapper);
            }
            return this._options.counter ? groupWrapper.append(box).append(counter) : groupWrapper.append(box) ;
        },
        _updateCounters: function() {
            if (this._options.counter) {
                var uTotal = this._unselected.find('li'),
                    uVisible = uTotal.filter(':visible'),
                    sTotal = this._selected.find('li'),
                    sVisible = sTotal.filter(':visible');
                this._unselected
                    .find('.item-counter')
                    .text(this._options.counter(uVisible.size(), uTotal.size()));
                this._selected
                    .find('.item-counter')
                    .text(this._options.counter(sVisible.size(), sTotal.size()));
            }
        }
    };
    
    
    DlbItem.prototype = {
        /*
        params: {
            instance: (an instance of DualListBox),
            option: (jQuery wrapped option element, or undef),
            value: (the value of the item, or undef),
            text: (the text of the item, or undef),
            selected: (bool or undef)
        }
        */
        init: function(params) {
            this.instance = params.instance;
            if (params.option) {
                this.option = $(params.option);
                if (this.option.attr('selected')) { this.selected = true; }
                this.value = this.option.val();
                this.text = this.option.text();
            } else {
                this.selected = params.selected;
                this.text = params.text;
                this.value = params.value;
                this.option = $('<option />', { value: this.value })
                              .text(this.text)
                              .appendTo(this._instance.target);
            }
            this.listItem = $('<li />', { 'data-value': this.value, 'class': 'draggable' })
                            .text(this.text)
                            .disableSelection();
        },
        value: '',
        text: '',
        selected: false,
        option: null,
        listItem: null,
        //liCopy: null,
        select: function() {
            if (this.listItem.is(':visible')) {
                this.insertIn($('.selected-wrapper .item-list', this.instance._container));
                this.option.attr('selected','selected');
                this.selected = true;
                return true;
            }
        },
        unselect: function() {
            if (this.listItem.is(':visible')) {
                this.insertIn($('.unselected-wrapper .item-list', this.instance._container));
                this.option.removeAttr('selected');
                this.selected = false;
                return true;
            }
        },
        setSelected: function(selected) {
            return selected ? this.select : this.unselect;        
        },
        place: function(index) {
            this.listItem.data('index', index);
            if (this.selected) {
                this.listItem.appendTo($('.selected-wrapper .item-list', this.instance._container));
            } else {
                this.listItem.appendTo($('.unselected-wrapper .item-list', this.instance._container));
            }
        },
        insertIn: function(itemList) {
            this.listItem.removeClass('active last-active');
            var list = itemList.children('li');
            if (list.size() == 0) {
                itemList.append(this.listItem);
                return;
            }
            var toSort = [],
                needle = {text: this.text, value: this.value};
            toSort.push(needle);
            list.each(function() {
                toSort.push({ text: $(this).text(), value: $(this).data('value') });
            });
            toSort.sort(this.instance._options.sort);
            var i = $.inArray(needle, toSort);
            if (i == list.size()) {
                $(list[i - 1]).after(this.listItem);
            } else {
                $(list[i]).before(this.listItem);
            }
        },
        instance: undefined
    };
    
    DlbFilter.prototype = {
        /*
        args = {
            targetList: (ul elem),
            input: (input elem for filter),
            clear: (clear elem for filter),
            instance: (dlb instance)
        }
        */
        init: function(args) {
            var self = this;
            this.targetList = args.targetList;
            this.input = args.input;
            this.clear = args.clear;
            this.instance = args.instance;
            this.input.keyup(function() {
                self.filter($(this).val());
            });
            this.clear.click(function() {
                self.input.val('');
                self.filter('');
            });
        },
        filter: function(filterString) {
            var self = this;
            if (filterString === '') {
                self.targetList.find('li').show();
            } else {
                $.each(self.targetList.find('li'), function() {
                    var op = self.instance.items[$(this).data('index')].option;
                    if (self.instance._options.filter(op, filterString)) {
                        $(this).hide();
                    } else {
                        $(this).show();
                    }
                });
            }
            self.instance._updateCounters();
        },
        targetList: null,
        input: null,
        clear: null,
        instance: null
    };

    $.fn.dualListBox = function(options) {
        return this.each(function() {

            var box = new DualListBox();
            box.init(this, options);

        });
    };


})(jQuery);