import "./style.css";
//import * as d3 from "d3";
import * as Plot from "@observablehq/plot";
import * as topojson from "topojson";
import type { FeatureCollection } from "geojson";

type Place = {
  name: string;
  latitude: number | null; // Use null for places without coordinates
  longitude: number | null; // Use null for places without coordinates
};

type Migration = {
  from: number;
  to: number;
  year?: number | string;
  core?: boolean;
  generation: -3 | -2 | -1 | 0 | 1;
};

type Family = {
  name: string;
  places: Place[];
  migrations: Migration[];
};

type FamilyData = {
  families: Family[];
};

const migrationToArrowData = (migration: Migration, places: Place[]) => {
  const { from, to } = migration;
  const start = places[from];
  const end = places[to];
  return [
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
  ];
};

const file = await fetch("countries-50m.json");
const world = (await file.json()) as TopoJSON.Topology;
const data = (await fetch("families.json").then((d) => d.json())) as FamilyData;
console.log(data);

const generationColor = new Map([
  [-3, "#007F00"],
  [-2, "#007F00"],
  [-1, "#007FFF"],
  [0, "#7F0000"],
  [1, "#000000"],
]);

const generationName = new Map([
  [-3, "great-great-grandparents"],
  [-2, "great-grandparents"],
  [-1, "grandparents"],
  [0, "parents"],
  [1, "core family"],
]);

const countries = topojson.feature(
  world,
  world.objects.countries
) as unknown as FeatureCollection;
const land = topojson.feature(world, world.objects.land);

let plot: SVGSVGElement | HTMLElement;
const render = (data: FamilyData) => {
  //const circle = d3.geoCircle().center([0, 20]).radius(55).precision(2)();
  if (plot) plot.remove();
  plot = Plot.plot({
    width: document.body.clientWidth,
    height: document.body.clientHeight,
    projection: {
      type: "equirectangular",
      clip: true,
      domain: {
        type: "Polygon",
        coordinates: [
          [
            [-50, -30],
            [-50, 60],
            [50, 60],
            [50, -30],
            [-50, -30],
          ],
        ],
      },
      //type: "equal-earth",
      //rotate: [0, 0],
      //domain: circle,
      //inset: 10,
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
      data.families.map((family) => {
        const { places, migrations } = family;
        console.log(family);
        const arrows = migrations.map((migration) => {
          const { core, generation } = migration;
          const color = generationColor.get(core ? 1 : generation);
          return Plot.arrow(migrationToArrowData(migration, places), {
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
            stroke: color,
            sweep: "-x",
          });
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
            dx: 6,
          })
        );
        // place marks on the map
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
};

render(data);

const controls = document.querySelector<HTMLDivElement>("#controls")!;
controls.innerHTML += data.families
  .map((family, i) => {
    return `<div><label><input type="checkbox" checked family-id="${i}" />${family.name}</label></div>`;
  })
  .join("");

// render colors legend
controls.innerHTML +=
  `<div class="legend">` +
  Array.from(generationColor.keys())
    .map((generation) => {
      const color = generationColor.get(generation);
      const name = generationName.get(generation);
      return `<div>
        <span class="legend--color" style="background-color: ${color}"></span>
        <span class="legend--label">${name}</span>
      </div>`;
    })
    .join("") +
  "</div>";

controls.innerHTML += `<div class="controls">
  <button id="save">Download map</button>
</div>`;

let timer: number;
controls.addEventListener("change", () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const checked = Array.from(
      document.querySelectorAll<HTMLInputElement>("input[type=checkbox]")
    )
      .filter((d) => d.checked)
      .map((d) => parseInt(d.getAttribute("family-id")!));
    const filteredData = {
      families: data.families.filter((_, i) => checked.includes(i)),
    };
    render(filteredData);
  }, 250);
});

document
  .querySelector<HTMLButtonElement>("#save")!
  .addEventListener("click", () => {
    const svg = document.querySelector<SVGSVGElement>("svg")!;
    const svgData = new XMLSerializer().serializeToString(svg);
    // save SVG as file
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    // download SVG file
    link.download = "map.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
