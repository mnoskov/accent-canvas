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
        fillOpacity: 0,
        stroke: 'none',
        strokeWidth: 0
    },
    hoverStyle: {
        fill: '#1CBB9D',
        fillOpacity: 0.4,
        stroke: '#1CBB9D',
        strokeWidth: 3,
        strokeOpacity: 1
    },
    hoverSpeed: 100
});
```
