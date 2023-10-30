import "./style.css";
import * as d3 from "d3";
import * as Plot from "@observablehq/plot";
import * as topojson from "topojson";
import type { FeatureCollection } from "geojson";

type Place = {
  name: string;
  latitude: number | null; // Use null for places without coordinates
  longitude: number | null; // Use null for places without coordinates
};

type Family = {
  name: string;
  places: Place[];
};

type FamilyData = {
  families: Family[];
};

const file = await fetch("countries-50m.json");
const world = (await file.json()) as TopoJSON.Topology;
const data = (await fetch("families.json").then((d) => d.json())) as FamilyData;
console.log(data);

// 10 random dark pastel colors with high difference that would look good on a
// white and light grey background
const colors = [
  "#7F7F7F",
  "#007F7F",
  "#7F007F",
  "#007F00",
  "#7F7F00",
  "#00007F",
  "#7F0000",
  "#000000",
  "#007FFF",
  "#7F00FF",
];

const countries = topojson.feature(
  world,
  world.objects.countries
) as unknown as FeatureCollection;
const land = topojson.feature(world, world.objects.land);

const circle = d3.geoCircle().center([0, 20]).radius(65).precision(2)();
const plot = Plot.plot({
  width: document.body.clientWidth,
  height: 800,
  projection: {
    type: "azimuthal-equidistant",
    //type: "equal-earth",
    //rotate: [-19, -44],
    domain: circle,
    inset: 10,
  },
  marks: [
    Plot.geo(land, {
      fill: "#ddd",
    }),
    Plot.geo(countries, {
      stroke: "#aaa",
      strokeWidth: 0.5,
    }),
    // Plot.text(
    //   countries.features.filter(
    //     (d) =>
    //       d.properties!.name === "Israel" ||
    //       d.properties!.name === "France" ||
    //       d.properties!.name === "Russia" ||
    //       d.properties!.name === "Germany" ||
    //       d.properties!.name === "Spain"
    //   ),
    //   Plot.centroid({
    //     text: (d) => d.properties.name,
    //     fill: "currentColor",
    //     stroke: "white",
    //   })
    // ),
    data.families.map((family, i) => {
      // group places in pairs to draw arrows
      const places = family.places.filter(
        (place) => place.latitude !== null && place.longitude !== null
      );
      const arrowData: [Place, Place][] = [];
      for (let i = 0; i < places.length - 1; i++) {
        arrowData.push([places[i], places[i + 1]]);
      }
      console.log(family.name, family.places);
      const arrows = arrowData.map((arrow) => {
        const [start, end] = arrow;
        return Plot.arrow(
          [
            {
              x1: start.longitude!,
              y1: start.latitude!,
              x2: end.longitude!,
              y2: end.latitude!,
            },
            {
              x1: start.longitude!,
              y1: start.latitude!,
              x2: end.longitude!,
              y2: end.latitude!,
            },
          ],
          {
            bend: 27,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeMiterlimit: 6,
            headLength: 14,
            headAngle: 40,
            strokeWidth: 1,
            x1: "x1",
            x2: "x2",
            y1: "y1",
            y2: "y2",
            stroke: colors[i],
          }
        );
      });
      const texts = Plot.text(
        places.map((place) => {
          return {
            type: "Feature",
            properties: { name: place.name },
            geometry: {
              type: "Point",
              coordinates: [place.longitude!, place.latitude!],
            },
          };
        }),
        Plot.centroid({
          text: (d) => d.properties.name,
          //textAnchor: "start",
          frameAnchor: "left",
          dx: 12,
        })
      );
      const dots = Plot.dot(places, {
        x: "longitude",
        y: "latitude",
        r: 2,
        stroke: "red",
        fill: "red",
        fillOpacity: 0.2,
      });
      return [...[dots], ...arrows, ...[texts]];
    }),
  ],
});
const canvas = document.querySelector<HTMLDivElement>("#app")!;
canvas.append(plot);
