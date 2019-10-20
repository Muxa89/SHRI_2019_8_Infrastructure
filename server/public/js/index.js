/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

function getTableRow(build) {
  const buildId = document.createElement('td');
  buildId.innerText = build.id;

  const hash = document.createElement('td');
  hash.innerText = build.hash;

  const command = document.createElement('td');
  command.innerText = build.command;

  const state = document.createElement('td');
  state.innerText = build.state;

  const link = document.createElement('td');
  link.appendChild(document.createElement('a'));
  link.children[0].innerText = 'Ссылка';
  link.children[0].setAttribute('href', `/build/${build.id}`);

  const row = document.createElement('tr');
  row.appendChild(buildId);
  row.appendChild(hash);
  row.appendChild(command);
  row.appendChild(state);
  row.appendChild(link);

  return row;
}

function fillBuildTable(builds) {
  const tbody = document.querySelector('#build_table tbody');
  while (tbody.firstChild) {
    tbody.removeChild(tbody.firstChild);
  }

  builds.sort((a, b) => {
    return b.id - a.id;
  });

  builds.forEach(build => {
    tbody.appendChild(getTableRow(build));
  });
}

function refresh() {
  axios.get('/status').then(response => {
    const builds = response.data.builds;
    console.log(builds);
    fillBuildTable(Object.values(builds));
  });
}

function startBuild() {
  const button = document.getElementById('build_button');
  button.setAttribute('disabled', 'true');

  const hash = document.getElementById('hash').value;
  const command = document.getElementById('command').value;

  axios
    .post('/', {
      hash,
      command,
    })
    .then(() => {
      button.removeAttribute('disabled');
      refresh();
    });
}

refresh();
setInterval(refresh, 3000);
