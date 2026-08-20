(function () {
    'use strict';

    function initFaq() {
        var searchInput = document.getElementById('faqSearch');
        var clearButton = document.getElementById('faqSearchClear');
        var resetButton = document.getElementById('faqEmptyReset');
        var status = document.getElementById('faqSearchStatus');
        var emptyState = document.getElementById('faqEmpty');
        var groups = Array.prototype.slice.call(document.querySelectorAll('[data-faq-group]'));
        var items = Array.prototype.slice.call(document.querySelectorAll('[data-faq-item]'));
        var questions = Array.prototype.slice.call(document.querySelectorAll('.faq-item__question'));
        var total = items.length;

        function setExpanded(button, expanded) {
            var answer = document.getElementById(button.getAttribute('aria-controls'));
            var icon = button.querySelector('.faq-item__icon i');
            button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            button.closest('.faq-item').classList.toggle('is-open', expanded);
            if (answer) {
                answer.hidden = !expanded;
            }
            if (icon) {
                icon.className = expanded ? 'fas fa-minus' : 'fas fa-plus';
            }
        }

        questions.forEach(function (button, index) {
            setExpanded(button, false);
            button.addEventListener('click', function () {
                setExpanded(button, button.getAttribute('aria-expanded') !== 'true');
            });
            button.addEventListener('keydown', function (event) {
                var targetIndex = null;
                if (event.key === 'ArrowDown') targetIndex = (index + 1) % questions.length;
                if (event.key === 'ArrowUp') targetIndex = (index - 1 + questions.length) % questions.length;
                if (event.key === 'Home') targetIndex = 0;
                if (event.key === 'End') targetIndex = questions.length - 1;
                if (targetIndex !== null) {
                    event.preventDefault();
                    questions[targetIndex].focus();
                }
            });
        });

        function normalize(value) {
            return String(value || '').trim().toLocaleLowerCase('zh-CN');
        }

        function filterFaq() {
            var keyword = normalize(searchInput ? searchInput.value : '');
            var visibleCount = 0;

            items.forEach(function (item) {
                var matches = keyword === '' || normalize(item.getAttribute('data-search')).indexOf(keyword) !== -1;
                item.hidden = !matches;
                if (matches) visibleCount += 1;
            });

            groups.forEach(function (group) {
                var hasVisibleItem = group.querySelector('[data-faq-item]:not([hidden])') !== null;
                group.hidden = !hasVisibleItem;
            });

            if (clearButton) clearButton.hidden = keyword === '';
            if (emptyState) emptyState.hidden = visibleCount !== 0;
            if (status) {
                status.textContent = keyword === ''
                    ? '共 ' + total + ' 个常见问题'
                    : '找到 ' + visibleCount + ' 个相关问题';
            }
        }

        function resetSearch() {
            if (!searchInput) return;
            searchInput.value = '';
            filterFaq();
            searchInput.focus();
        }

        if (searchInput) searchInput.addEventListener('input', filterFaq);
        if (clearButton) clearButton.addEventListener('click', resetSearch);
        if (resetButton) resetButton.addEventListener('click', resetSearch);
        filterFaq();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFaq);
    } else {
        initFaq();
    }
})();
