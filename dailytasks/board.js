(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const grid = get('task-board');
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const rotationMs = 20000;
  let allTasks = [], tasks = [], page = 0, size = 4, timer, resizeTimer;
  let loaded = false, dateKey = '';
  const today = () => days[new Date().getDay()];
  const pages = () => Math.ceil(tasks.length / size);

  function message(title, text, error = false) {
    clearTimeout(timer);
    grid.hidden = true;
    get('message-container').hidden = false;
    get('message-container').dataset.error = String(error);
    get('message-title').textContent = title;
    get('message-text').textContent = text;
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }
  function card(task, index) {
    const node = element('article', 'task-card', '');
    const meta = element('div', 'card-meta', '');
    meta.append(element('span','task-number',String(index+1).padStart(2,'0')),
      element('span','schedule-tag',task.day.includes('Daily') ? 'Every day' : today()));
    const assignment = element('div','assignment','');
    assignment.append(element('span','assignment-label','Assigned to'),
      element('span','assignee',String(task.assignee || 'Unassigned')));
    node.append(meta,element('h3','task-title',String(task.task || 'Untitled task')),assignment);
    return node;
  }
  function draw() {
    const start = page * size;
    grid.dataset.size = String(size);
    grid.replaceChildren(...tasks.slice(start,start+size).map((task,i) => card(task,start+i)));
  }
  // Measure every page before rotating so long tasks get more space, never ellipses.
  function fitPages() {
    for (const candidate of (window.innerWidth <= 800 ? [2,1] : [4,2,1])) {
      size = candidate;
      let fits = true;
      for (page=0; page<pages(); page++) {
        draw();
        if ([...grid.children].some(node => node.scrollHeight > node.clientHeight+2)) { fits=false; break; }
      }
      if (fits) break;
    }
    page=0;
  }
  function rotate() {
    clearTimeout(timer);
    if (pages()<=1 || document.hidden || grid.hidden) return;
    timer=setTimeout(() => changePage(1),rotationMs);
  }
  function render() {
    draw();
    get('task-count').textContent=tasks.length+' '+(tasks.length===1 ? 'task' : 'tasks')+' scheduled';
    rotate();
  }
  function changePage(direction) {
    if (!pages() || grid.hidden) return;
    page=(page+direction+pages())%pages();
    render();
  }
  function refresh() {
    tasks=allTasks.filter(task => Array.isArray(task.day) && (task.day.includes(today()) || task.day.includes('Daily')));
    if (!tasks.length) {
      get('task-count').textContent='0 tasks scheduled';
      message('No tasks scheduled today','The schedule will update automatically when assignments are added.');
      return;
    }
    grid.hidden=false;
    get('message-container').hidden=true;
    fitPages();
    render();
  }
  function updateDate() {
    const now=new Date();
    const nextKey=now.toDateString();
    if (dateKey && dateKey!==nextKey && loaded) refresh();
    dateKey=nextKey;
  }
  window.dailyTasksBoard={
    setTasks(incoming) {
      allTasks=incoming; loaded=true;
      refresh();
    },
    setError(text) {
      if (!(loaded && tasks.length)) {
        get('task-count').textContent='Unable to load schedule';
        message('Schedule unavailable',text,true);
      }
    }
  };
  window.addEventListener('keydown',event=>{
    if(event.key==='ArrowRight') changePage(1);
    if(event.key==='ArrowLeft') changePage(-1);
  });
  window.addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{if(loaded && !grid.hidden) refresh();},150);
  });
  document.addEventListener('visibilitychange',rotate);
  updateDate();
  setInterval(updateDate,10000);
  // Covers a blocked Firebase module download as well as a connection timeout.
  setTimeout(()=>{
    if(!loaded) window.dailyTasksBoard.setError('The station schedule could not be reached. Check the connection and reload.');
  },25000);
})();
