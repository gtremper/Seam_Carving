$(document).ready(function(){
	
	var canvas = document.getElementById("myCanvas");
	var context = canvas.getContext("2d");
	var img = document.createElement("img");
	var mouseDown = false;
	var hasText = true;
	var imgWidth = -1;
	var imgHeight = -1;
    // use this filter for now. Maybe switch to Sobel later?
    var grad_filter = [0, -1, 0,
                      -1,  0, 1,
                       0,  1, 0];
	
	var clearCanvas = function () {
		if (hasText) {
			context.clearRect(0, 0, canvas.width, canvas.height);
			hasText = false;
		}
	};
	
	// Adding instructions
	context.fillText("Drop an image onto the canvas", 240, 200);
	context.fillText("Click a spot to set as brush color", 240, 220);
    
	// Image for loading	
	img.addEventListener("load", function () {
		clearCanvas();
		canvas.height = img.height;
		canvas.width = img.width*1.5;
		imgHeight = img.height;
		imgWidth = img.width;
		context.drawImage(img, 0, 0);
	}, false);
	
	// To enable drag and drop
	canvas.addEventListener("dragover", function (evt) {
		evt.preventDefault();
	}, false);

	// Handle dropped image file - only Firefox and Google Chrome
	canvas.addEventListener("drop", function (evt) {
		var files = evt.dataTransfer.files;
		if (files.length > 0) {
			var file = files[0];
			if (typeof FileReader !== "undefined" && file.type.indexOf("image") != -1) {
				var reader = new FileReader();
				// Note: addEventListener doesn't work in Google Chrome for this event
				reader.onload = function (evt) {
					img.src = evt.target.result;
				};
				reader.readAsDataURL(file);
			}
		}
		evt.preventDefault();
	}, false);
	
	// Detect mousedown
	canvas.addEventListener("mousedown", function (evt) {
		mouseDown = true;
	}, false);

	// Detect mouseup
	canvas.addEventListener("mouseup", function (evt) {
		mouseDown = false;
	}, false);

	// Draw, if mouse button is pressed
	canvas.addEventListener("mousemove", function (evt) {
		if (mouseDown) {
			//resizeImage(1);
		}
	}, false);
	
	$("#wider").click(function(){
		resizeImage(5);
	});
	
	$("#shorter").click(function(){
		resizeImage(-5);
	});

    $("#energy1").click(function() {
        var imgData = context.getImageData(0,0,imgWidth,imgHeight);
        var gradient = Filters.energy1(imgData);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.putImageData(gradient, 0, 0);
    });
	
	var resizeImage = function(pixels){
		var imgData = context.getImageData(0,0,imgWidth,imgHeight); // single dimension array of RGBA
		var newWidth = imgWidth+pixels;
		var newImg = context.createImageData(newWidth,imgHeight);
		var i = 0;
		var extra=0;
		for (var y=0; y<imgData.data.length/4; y++){
			if (y%imgWidth < newWidth){
				newImg.data[4*i] = imgData.data[4*y];
				newImg.data[4*i+1] = imgData.data[4*y+1];
				newImg.data[4*i+2] = imgData.data[4*y+2];
				newImg.data[4*i+3] = imgData.data[4*y+3];
				i+=1;
				if (y%imgWidth === imgWidth-1){
					for (extra=0; extra<pixels; extra++){
						newImg.data[4*i] = 0;
						newImg.data[4*i+1] = 0;
						newImg.data[4*i+2] = 0;
						newImg.data[4*i+3] = 255;
						i+=1;
					}
				}
			}
		}
		imgWidth = newWidth;
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.putImageData(newImg,0,0);
	};
	
});
