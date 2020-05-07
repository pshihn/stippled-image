# \<stippled-image\>

*\<stippled-image\>* is a custom element to show the stippled version of an image. A stippled image gives a [Wall Street Journal's headcut](https://www.google.com/search?q=wall+street+journal+hedcut+obama&tbm=isch) like look. This effect is achieved by using *Weighted Voronoi Stippling* as shown in this [Observable notebook](https://observablehq.com/@mbostock/voronoi-stippling).

![Stippled Obama](https://user-images.githubusercontent.com/833927/81326900-5f113200-904f-11ea-8ca0-a3e1928ddcd7.png)

## Using

This element is available [on npm](https://www.npmjs.com/package/stippled-image)

```html
<script type="module" src="https://unpkg.com/stippled-image?module"></script>

<stippled-image src="./obama.png"></stippled-image>
```

[View live example](https://glitch.com/~stippled-image-demo)

## Properties and Attributes

You can configure the image using following properties/attributes.

#### src

The URL of the image

#### width & height

Configure the size of the image

```html
<stippled-image src="./obama.png" width="517" height="646"></stippled-image>
```

#### sampling

This lets you configure the number of dots to show. The number of dots is area of the image divided by the sampling value. 

#### points

You can be explicit about how many points you want rather than sample it. 

```html
<stippled-image src="./obama.png" points="10000"></stippled-image>
```

#### radius

Radius of each dot in pixels

#### color

Color of the dot


