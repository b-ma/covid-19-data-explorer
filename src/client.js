import '@babel/polyfill';
import { html, render } from 'lit-html';
import * as d3scaleChromatic from 'd3-scale-chromatic';
import * as d3scale from 'd3-scale';
import * as d3color from 'd3-color';

// use local files in development
const DEV = window.location.hostname === '127.0.0.1';

const dataSrc = DEV ?
  'assets/dev-datasets/timeseries.json' :
  'https://pomber.github.io/covid19/timeseries.json';
const geoPopulationSrc = DEV ?
  'assets/dev-datasets/world-population.geo.json' :
  'https://raw.githubusercontent.com/MinnPost/simple-map-d3/master/example-data/world-population.geo.json';

const localStorageKey = 'interface-state';
const numConfirmedCaseLimitForRelativeTime = 200;
let datasets;
let geoPopulation;

const storedState = JSON.parse(localStorage.getItem(localStorageKey));

const state = Object.assign({
  version: 0,
  logScale: false,
  selectedCountries: ['France', 'US', 'China'],
  timeOrigin: 'absolute', // use all data
  formulas: [
    {
      value: 'confirmed',
      enabled: true,
    },
    {
      value: 'deaths',
      enabled: false,
    },
    {
      value: 'recovered',
      enabled: false,
    },
    {
      value: 'confirmedRate',
      enabled: false,
    },
    {
      value: 'confirmed - (recovered - deaths)',
      enabled: true,
    }
  ],
}, storedState);

function saveState() {
  const json = JSON.stringify(state);
  localStorage.setItem(localStorageKey, json);
}

function addFomula() {
  state.formulas.push({
    value: '',
    enabled: true,
  });

  saveState();
  renderApp();
}

function updateAllFormulas() {
  Array.from(document.forms).forEach(form => {
    const index = form.dataset.index;
    const formData = new FormData(form);
    const jsonData = {};

    for (const [key, value] of formData.entries()) {
      jsonData[key] = value;
    }

    const formula = state.formulas[index];
    formula.enabled = (jsonData.enabled === 'on');
    // @todo - test value with dummy data, just to check it return a number
    formula.value = jsonData.value;
  });

  saveState();
  renderApp();
  renderChart();
}

function deleteFormula(index) {
  state.formulas.splice(index, 1);

  saveState();
  renderApp();
  renderChart();
}

function setTimeOrigin(e) {
  state.timeOrigin = e.target.value;

  saveState();
  renderApp();
  renderChart();
}

function toggleCountry(e) {
  const country = e.target.value;
  const index = state.selectedCountries.indexOf(country);
  if (index !== -1) {
    state.selectedCountries.splice(index, 1);
  } else {
    state.selectedCountries.push(country);
  }

  saveState();
  renderApp();
  renderChart();
}

function toggleLogScale(e) {
  state.logScale = e.target.checked

  saveState();
  renderApp();
  renderChart();
}

function renderChart() {
  const layout = state.logScale ? {
    yaxis: {
      type: 'log',
      autorange: true
    }
  } : {};

  if (state.selectedCountries.length) {
    const data = state.selectedCountries.map((country, index) => {
      const rawDataset = datasets[country];
      let dataset;
      let xAxis;

      if (state.timeOrigin === 'absolute') {
        dataset = rawDataset;
        xAxis = dataset.map(d => d.date);
      } else if (state.timeOrigin === 'relative') {
        dataset = rawDataset.filter(d => d.relativeDaysAfterNConfirmed !== undefined);
        xAxis = dataset.map(d => d.relativeDaysAfterNConfirmed);
      }

      const activeFormulas = state.formulas.filter(formula => formula.enabled && formula.value);
      const normIndex = (index + 1) / state.selectedCountries.length;
      const maxColor = d3color.color(d3scaleChromatic.interpolateTurbo(normIndex));
      const minColor = d3color.color(maxColor);
      minColor.opacity = 0.5;
      maxColor.opacity = 1;

      const palette = d3scale.scaleLinear()
        .domain([0, activeFormulas.length - 1])
        .range([minColor, maxColor]);

      return activeFormulas.map((formula, i) => {
        const { value } = formula;

        const args = ['confirmed', 'deaths', 'recovered', 'confirmedRate', 'deathsRate', 'recoveredRate'];
        const body = `
          const retValue = ${value};
          // fix Infinity or NaN output
          return isFinite(parseInt(retValue)) ? retValue : 0;
        `;
        const adapter = new Function(args, body);

        return {
          name: `${country} - ${value}`,
          // this will have to be smarter too
          x: xAxis,
          y: dataset.map(d => {
            const {
              confirmed,
              deaths,
              recovered,
              confirmedRate,
              deathsRate,
              recoveredRate,
            } = d;

            return adapter(confirmed, deaths, recovered, confirmedRate, deathsRate, recoveredRate);
          }),
          mode: 'line',
          line: {
            color: palette(i),
            width: 1,
          }
        };
      });
    });

    // flatten for Plotly
    const flatData = data.flat();
    Plotly.newPlot('chart', flatData, layout);
  } else {
    Plotly.newPlot('chart', [], layout);
  }


}

function renderApp() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  render(html`
    <div id="controls">
      <h2>> controls</h2>
      <label class="large">
        <input
          type="radio"
          name="timeOrigin"
          .checked="${state.timeOrigin === 'absolute'}"
          @click=${setTimeOrigin}
          value="absolute">
        align according to the date
      </label>
      <label class="large">
        <input
          type="radio"
          name="timeOrigin"
          .checked="${state.timeOrigin === 'relative'}"
          @click=${setTimeOrigin}
          value="relative">
        align according to the # of days after ${numConfirmedCaseLimitForRelativeTime} confirmed cases
      </label>
      <label>
        <input
          name="logScale"
          type="checkbox"
          .checked="${state.logScale}"
          @change="${toggleLogScale}" />
        log scale
      </label>

      <h2>> formulas</h2>
      <p>
        > Create formulas to parse the data.<br />
        You can use the following variables:<br />
        <ul>
          <li>confirmed</li>
          <li>deaths</li>
          <li>recovered</li>
          <li>confirmedRate</li>
          <li>deathsRate</li>
          <li>recoveredRate</li>
        </ul>
      </p>
      ${state.formulas.map((formula, index) => {
        return html`
          <div>
            <form
              data-index="${index}"
              @submit="${e => e.preventDefault()}"
            >
              <input
                name="value"
                type="text"
                value="${formula.value}" />
              <br />
              <label>
                <input
                  name="enabled"
                  type="checkbox"
                  .checked="${formula.enabled}" />
                enabled
              </label>
              <button
                value="delete"
                @click="${e => { e.preventDefault(); e.stopPropagation(); deleteFormula(index); } }"
              >delete</button>
            </form>
          </div>
        `;
      })}
      <br />
      <button @click="${addFomula}">add formula</button>
      <button class="large highlight" @click="${updateAllFormulas}">update</button>

      <h2>> countries</h2>
      <p>selected countries:<br />
        ${state.selectedCountries.join(', ')}
      </p>
      <div id="select-countries-container">
        ${Object.keys(datasets).map(country => {
          return html`
            <label class="large">
              <input
                type="checkbox"
                .checked="${state.selectedCountries.indexOf(country) !== -1}"
                value="${country}"
                @change=${toggleCountry}
              />
              ${country}
            </label>
          `
        })}
      </div>
    </div>
    <div id="chart-container">
      <h1>> COVID-19 - Simple Data Explorer</h1>
      <div id="chart"></div>
    </div>
    <div id="credits">
      <h4>> Credits / Links</h4>
      <ul>
        <li>
          Data are retrieved from <a target="_blank" href="https://github.com/pomber/covid19">https://github.com/pomber/covid19</a>,<br />
          which are themselves parsed from <a target="_blank" href="https://github.com/CSSEGISandData/COVID-19">https://github.com/CSSEGISandData/COVID-19</a>.
          </li>
        <li>
          Charts are created using <a target="_blank" href="https://plotly.com/">https://plotly.com/</a>.
        </li>
        <li>
          Github: <a href="https://github.com//b-ma/covid-19-data-explorer/">https://github.com//b-ma/covid-19-data-explorer/</a>
        </li>
      </ul>
    </div>
  `, document.querySelector('#container'));
}

async function init() {
  const $container = document.querySelector('#container');

  render(html`
    <div id="loader"></div>
  `, $container);
  // loading data

  [datasets, geoPopulation] = await Promise.all([
    fetch(dataSrc).then(res => res.json()),
    // fetch(geoPopulationSrc).then(res => res.json()), // we finally don't use that
  ]);

  // add derivative and #day relative to >= 25 confirmed
  for (let country in datasets) {
    const dataset = datasets[country];

    // no derivative for first entry
    dataset[0].confirmedRate = 0;
    dataset[0].deathsRate = 0;
    dataset[0].recoveredRate = 0;

    let nConfirmedIndex = dataset[0].confirmed >= numConfirmedCaseLimitForRelativeTime ? 0 : null;

    for (let i = 1; i < dataset.length; i++) {
      const prev = dataset[i - 1];
      const current = dataset[i];

      if (nConfirmedIndex === null && current.confirmed >= numConfirmedCaseLimitForRelativeTime) {
        nConfirmedIndex = i;
      }

      current.confirmedRate = current.confirmed - prev.confirmed;
      current.deathsRate = current.deaths - prev.deaths;
      current.recoveredRate = current.recovered - prev.recovered;

      if (nConfirmedIndex !== null) {
        current.relativeDaysAfterNConfirmed = i - nConfirmedIndex;
      }
    }
  }

  renderApp();
  renderChart();

  window.addEventListener('resize', () => {
    renderApp();
    renderChart();
  });
}

init();
