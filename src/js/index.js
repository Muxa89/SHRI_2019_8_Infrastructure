/* eslint-disable no-undef */

function getTableRow(build) {
  const buildId = document.createElement('td');
  buildId.innerText = build.buildId;

  const state = document.createElement('td');
  state.innerText = build.state;

  const hash = document.createElement('td');
  hash.innerText = build.hash;

  const link = document.createElement('td');
  link.appendChild(document.createElement('a'));
  link.children[0].innerText = 'Ссылка';
  link.children[0].setAttribute('href', `/build/${build.buildId}`);

  const row = document.createElement('tr');
  row.appendChild(buildId);
  row.appendChild(hash);
  row.appendChild(state);
  row.appendChild(link);

  return row;
}

function fillBuildTable(builds) {
  const tbody = document.querySelector('#build_table tbody');
  while (tbody.firstChild) {
    tbody.removeChild(tbody.firstChild);
  }

  builds.forEach(build => {
    tbody.appendChild(getTableRow(build));
  });
}

function refresh() {
  axios.get('/buildState').then(response => {
    const builds = response.data.builds;
    console.log(builds);
    fillBuildTable(builds);
  });
}

refresh();
setInterval(refresh, 3000);
