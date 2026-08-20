(function($){
	'use script';
	$(window).on('load', function(event) {
        $('#preloader').delay(500).fadeOut(500);
    });
	// WOW JS
	new WOW().init();
	// Search
	$('.header-search-icon i.fa-search').click(function(){
        $('.header-top-search-form, .header-search-icon i.fa-times').addClass('active');
    });
    $('.header-search-icon i.fa-times').click(function(){
        $('.header-top-search-form, .header-search-icon i.fa-times').removeClass('active');
    });

	 // /*---slider activation---*/
    var $HeroSliderSlider = $('.hero-slider-full');
    if($HeroSliderSlider.length > 0){
        $HeroSliderSlider.owlCarousel({
            loop: true,
            dots:true,
            autoplay: true,
            autoplayTimeout: 20000,
            items: 1,
            nav:false,
            smartSpeed: 1500,
        });
    }
	 // /*---slider activation---*/
    var $TestimonialSlider = $('.testimonial-item-full');
    if($TestimonialSlider.length > 0){
        $TestimonialSlider.owlCarousel({
            loop: true,
            dots:true,
            autoplay: true,
            autoplayTimeout: 20000,
            items: 1,
            nav:false,
            smartSpeed: 1500,
        });
    }
	 // /*---slider activation---*/
    var $LatestProjectsSlider = $('.latest-projects-slider-full');
    if($LatestProjectsSlider.length > 0){
        $LatestProjectsSlider.owlCarousel({
            loop: true,
            dots:false,
            autoplay: true,
            autoplayTimeout: 20000,
            items: 3,
            nav:true,
            margin:30,
            smartSpeed: 1500,
            navText:['<span class="latest-p-slider-arrow"><i class="fa fa-angle-left"></i></span>','<span class="latest-p-slider-arrow"><i class="fa fa-angle-right"></i></span>'],
            responsive: {
                0: {
                    items: 1,
                    stagePadding: 0,
                    margin: 0,
                },
                767: {
                    items: 2
                },
                992: {
                    items: 2
                },
                1200: {
                    items: 3
                },
            }
        });
    }
	// Scroll Area
	$(document).ready(function(){
	    $('.scroll-area').click(function(){
	      	$('html').animate({
	        	'scrollTop' : 0,
	      	},700);
	      	return false;
	    });
	    $(window).on('scroll',function(){
	      	var a = $(window).scrollTop();
	      	if(a>400){
	            $('.scroll-area').slideDown(300);
	        }else{
	            $('.scroll-area').slideUp(200);
	        }
	    });
	});
	// Counter
    var $CounterUp = $('.counter');
    if($CounterUp.length > 0){
		$('.counter').counterUp({
	        delay: 10,
	        time: 2000
	    });
	}
	// Video Popup
	$('.video-btn a').magnificPopup({
	  	type: 'iframe'
	});
	$('.img-gallery-popup a').magnificPopup({
	  	type: 'image',
	   	gallery: {
	    	enabled: true
	  	},
	});
	var $portfolio = $('.p-projects-full');
	    if($portfolio.length > 0){
	        var mixer = mixitup('.p-projects-full');
	      var mixer = mixitup('.portF');
	      var mixer = mixitup('.portF', {
	        selectors: {
	          target: '.blog-item'
	        },
	        animation: {
	          duration: 100
	        }
	      });
	  }

	// Sticky Menu
	$(document).ready(function(){
		$(window).on('scroll',function(){
			var scroll = $(window).scrollTop();
			if(scroll < 150){
				$('.header-bottom').removeClass('sticky');
			}else{
				$('.header-bottom').addClass('sticky');
			}
		});
	});


}(jQuery));