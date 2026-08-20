/* ============================================================
   DDW 学术站 — 公共交互脚本
   依赖：jquery-3.6.0.min.js / bootstrap.min.js
   ============================================================ */
(function ($) {
  'use strict';

  $(document).ready(function () {

    /* ---------- 平滑滚动 ---------- */
    $('a[href^="#"]').on('click', function (e) {
      var target = $(this).attr('href');
      if (target.length > 1) {
        var $el = $(target);
        if ($el.length) {
          e.preventDefault();
          $('html, body').animate({ scrollTop: $el.offset().top - 70 }, 500);
        }
      }
    });

    /* ---------- 论文分类过滤 ---------- */
    var $filterBtns = $('.ddw-filter-btn');
    var $papers = $('.ddw-paper');
    if ($filterBtns.length && $papers.length) {
      $filterBtns.on('click', function () {
        var cat = $(this).data('filter');
        $filterBtns.removeClass('active');
        $(this).addClass('active');
        if (cat === 'all') {
          $papers.show();
        } else {
          $papers.each(function () {
            var cats = ($(this).data('cats') || '').split(',');
            if (cats.indexOf(cat) !== -1) {
              $(this).show();
            } else {
              $(this).hide();
            }
          });
        }
      });
    }

    /* ---------- 年份筛选（会议/论文） ---------- */
    var $yearBtns = $('.ddw-year-btn');
    var $yearItems = $('.ddw-year-item');
    if ($yearBtns.length && $yearItems.length) {
      $yearBtns.on('click', function () {
        var year = $(this).data('year');
        $yearBtns.removeClass('active');
        $(this).addClass('active');
        if (year === 'all') {
          $yearItems.show();
        } else {
          $yearItems.each(function () {
            if ($(this).data('year') == year) {
              $(this).show();
            } else {
              $(this).hide();
            }
          });
        }
      });
    }

    /* ---------- 核心数字计数动画 ---------- */
    var $counters = $('.ddw-stat .num[data-count]');
    if ($counters.length) {
      var animated = false;
      function tryCount() {
        if (animated) return;
        var $stats = $('.ddw-stats');
        if (!$stats.length) return;
        if ($(window).scrollTop() + $(window).height() > $stats.offset().top + 80) {
          animated = true;
          $counters.each(function () {
            var $el = $(this);
            var target = parseInt($el.data('count'), 10);
            $({ n: 0 }).animate({ n: target }, {
              duration: 1600,
              easing: 'swing',
              step: function () { $el.text(Math.floor(this.n)); },
              complete: function () { $el.text(target); }
            });
          });
        }
      }
      $(window).on('scroll', tryCount);
      tryCount();
    }

  });
})(jQuery);
