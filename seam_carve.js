$(document).ready(function(){
	$("h1")
		.on("click", function(){
			var element = $(this);
			element.fadeOut(1000, function(){
				if (element.text() === "HERP DERP") {
					element.text("Seam Carving for CS283");
				} else {
					element.text("HERP DERP");
				}
				element.fadeIn(1000);
			});
		});
		
		
});