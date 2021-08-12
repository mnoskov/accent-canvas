# Interactive image areas in canvas

```js
let accent = new Accent('.container', {
    image: '/images/map.jpg',
    areas: [{
        coords: [100,100, 100,200, 200,200, 200,100]
    }, {
        coords: [300,100, 300,200, 400,200, 400,100]
    }],
    startZoom: 'cover',
    style: {
        fill: 'none',
        opacity: 0,
        stroke: 'none',
        lineWidth: 0
    },
    hoverStyle: {
        fill: '#1CBB9D',
        opacity: 0.4,
        stroke: '#1CBB9D',
        lineWidth: 3
    },
    hoverSpeed: 100
});
```
