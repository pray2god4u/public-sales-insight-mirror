(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const icons = () => window.lucide?.createIcons();
  const make = (tag, value, className) => {
    const node = document.createElement(tag);
    if (value !== undefined) node.textContent = value;
    if (className) node.className = className;
    return node;
  };
  const number = value => Number(value).toLocaleString('ko-KR');
  const date = value => {
    if (!value) return '확인 필요';
    let raw = String(value);
    if (/^\d{8}$/.test(raw)) raw = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw)) raw = raw.replace(' ', 'T') + '+09:00';
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}).format(parsed);
  };
  const link = (value, label) => {
    try {
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return make('span', '원문 주소 확인 필요');
      const node = make('a', label);
      node.href = url.href; node.target = '_blank'; node.rel = 'noopener noreferrer';
      return node;
    } catch { return make('span', '원문 주소 확인 필요'); }
  };
  let applied = new URLSearchParams(location.search), bucket = applied.get('bucket') || 'current';
  let result = null, controller = null, requestId = 0, loading = false, copyReady = false;
  let toastTimer;
  const notify = message => {
    $('toast').textContent = message; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
  };
  $('query').value = applied.get('q') || '';
  for (const [id, values] of [['business', ['AI', '그룹웨어', 'ERP', '문서관리', '협업툴', '차세대 사업']], ['kind', ['발주계획', '사전규격', '본공고', '기관 문제', '기관 변화', '뉴스·기사', 'ISP/ISMP 이력']]]) {
    for (const value of values) $(id).append(new Option(value, value));
    $(id).value = applied.get(id) || '';
  }
  $('size').value = applied.get('size') || '25';
  function controls() {
    $('copyLink').disabled = loading || !copyReady;
    $('refresh').disabled = loading;
    for (const id of ['first', 'prev']) $(id).disabled = loading || !result || result.page <= 1;
    for (const id of ['next', 'last']) $(id).disabled = loading || !result || result.page >= result.pages;
    $('results').setAttribute('aria-busy', String(loading));
  }
  function showDetail(item) {
    $('detailKind').textContent = `${item.source} · ${item.kind}`;
    $('detailTitle').textContent = item.title;
    $('detailFields').replaceChildren();
    for (const [label, value] of [['기관', item.institution], ['사업 분야', item.businesses.join(' · ')], ['사업 예산', item.budget || '확인 필요'], ['원문 게시', date(item.posted)], ['마감', date(item.deadline)], ['최초 수집', date(item.discovered_at)], ['마지막 확인', date(item.last_seen_at)]]) {
      $('detailFields').append(make('dt', label), make('dd', value));
    }
    if (item.navigation?.reference) $('detailFields').append(make('dt', item.navigation.reference_label), make('dd', item.navigation.reference));
    $('assessment').replaceChildren();
    for (const [label, values] of [['연결 근거', item.strengths], ['추가 확인', item.checks]]) {
      if (!values.length) continue;
      const list = make('ul'); values.forEach(value => list.append(make('li', value)));
      $('assessment').append(make('h3', label), list);
    }
    $('citations').replaceChildren(make('h3', '공개 원문 근거'));
    for (const citation of item.citations) {
      const article = make('article');
      article.append(citation.url ? link(citation.url, citation.title || '원문 확인') : make('strong', citation.title), make('p', citation.excerpt || '본문은 원문에서 확인해 주세요.'), make('small', `게시일 ${date(citation.posted)}`));
      $('citations').append(article);
    }
    if (!item.citations.length) $('citations').append(make('p', '저장된 본문 발췌가 없습니다. 공식 원문을 확인해 주세요.'));
    $('detailLinks').replaceChildren(...sourceActions(item));
    $('detail').showModal();
    icons();
  }
  function sourceActions(item) {
    const nav = item.navigation || {};
    const nodes = [nav.url ? link(nav.url, nav.label) : make('span', '상세 주소 확인 필요', 'record-facts')];
    if (nav.reference) {
      nodes.push(make('small', `${nav.reference_label} ${nav.reference}`, 'record-reference'));
      const copy = make('button', undefined, 'icon-button');
      copy.type = 'button'; copy.title = `${nav.reference_label} 복사`; copy.setAttribute('aria-label', copy.title);
      const icon = make('i'); icon.setAttribute('data-lucide', 'copy'); copy.append(icon);
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(nav.reference); notify(`${nav.reference_label}를 복사했습니다.`); }
        catch { window.prompt(nav.reference_label, nav.reference); }
      });
      nodes.push(copy);
    }
    return nodes;
  }
  function render(data, submitted) {
    result = data; applied = new URLSearchParams(submitted);
    applied.set('page', data.page); applied.set('size', data.size);
    bucket = applied.get('bucket') || 'current';
    history.replaceState(null, '', `/situation-room?${applied}`);
    $('today').textContent = data.date;
    for (const id of ['current', 'reference', 'past']) $(`${id}Count`).textContent = number(data.counts[id]);
    $('newCount').textContent = number(data.new_count);
    const names = {completed: '최근 수집 완료', partial: '일부 출처 조회 미완료', failed: '최근 수집 실패 · 기존 확인 자료', running: '새 자료 수집 중 · 기존 확인 자료', interrupted: '최근 수집 중단 · 기존 확인 자료', not_started: '수집 이력 없음', unknown: '수집 상태 확인 필요'};
    $('collectionStatus').textContent = `${names[data.collection.status] || names.unknown}${data.collection.at ? ' · ' + date(data.collection.at) : ''}${data.collection.stale ? ' · 최신성 재확인 필요' : ''}`;
    $('collectionStatus').parentElement.classList.toggle('warning', data.collection.stale || !['completed', 'running'].includes(data.collection.status));
    $('scopeNote').textContent = data.scope_note;
    document.querySelectorAll('[data-bucket]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.bucket === bucket));
      button.querySelector('span').textContent = number(data.counts[button.dataset.bucket]);
    });
    $('resultCount').textContent = `${number(data.total)}건`;
    $('results').replaceChildren();
    for (const item of data.items) {
      const row = make('article', undefined, 'room-result');
      const institution = make('div');
      institution.append(make('div', item.institution, 'record-institution'), make('p', `${item.source} · ${item.kind}`, 'record-source'));
      const main = make('div'), title = make('button', item.title, 'record-title');
      title.type = 'button'; title.addEventListener('click', () => showDetail(item));
      const tags = make('div', undefined, 'record-tags'); item.businesses.forEach(b => tags.append(make('span', b)));
      const actions = make('div', undefined, 'record-action'); actions.append(...sourceActions(item));
      main.append(title, tags, make('p', item.strengths[0] || item.checks[0] || '원문 확인 필요', 'record-facts'), actions);
      const timing = make('div', undefined, 'record-timing');
      const deadline = make('p', undefined, 'record-facts');
      deadline.append('마감 ', make('strong', date(item.deadline), item.bucket === 'current' && item.deadline ? 'open-deadline' : ''));
      timing.append(deadline, make('p', `게시 ${date(item.posted)}`, 'record-facts'), make('p', `예산 ${item.budget || '확인 필요'}`, 'record-facts'));
      row.append(institution, main, timing); $('results').append(row);
    }
    $('empty').hidden = data.total !== 0;
    $('rangeText').textContent = data.total ? `${number((data.page-1)*data.size+1)}–${number(Math.min(data.page*data.size, data.total))} / ${number(data.total)}건` : '조회 결과 0건';
    $('pageText').textContent = `${data.page} / ${data.pages}`;
    copyReady = true;
    icons();
  }
  async function search(params) {
    const submitted = new URLSearchParams(params), serial = ++requestId;
    controller?.abort(); controller = new AbortController();
    const signal = controller.signal, timeout = setTimeout(() => controller?.signal === signal && controller.abort(), 12000);
    loading = true; copyReady = false; controls();
    $('loading').hidden = false; $('error').hidden = true; $('empty').hidden = true; $('results').hidden = true;
    try {
      const response = await fetch(`/api/public/room?${submitted}`, {signal, credentials: 'omit', cache: 'no-store'});
      const data = await response.json().catch(() => { throw new Error('응답을 확인할 수 없습니다. 잠시 후 다시 조회해 주세요.'); });
      if (!response.ok) throw new Error(data.error || '조회에 실패했습니다. 사업이 0건이라는 뜻은 아닙니다.');
      if (data.status !== 'ok' || !Array.isArray(data.items) || !data.counts || !data.collection || !Number.isInteger(data.total)) throw new Error('응답 형식이 올바르지 않습니다. 다시 조회해 주세요.');
      if (serial !== requestId) return;
      render(data, submitted); $('results').hidden = false;
    } catch (error) {
      if (serial !== requestId) return;
      result = null;
      $('errorText').textContent = signal.aborted ? '조회 시간이 초과되었습니다. 사업이 0건이라는 뜻은 아닙니다. 다시 조회해 주세요.' : error instanceof TypeError ? '서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 조회해 주세요.' : error.message;
      $('error').hidden = false;
      for (const id of ['currentCount', 'referenceCount', 'pastCount', 'newCount', 'resultCount', 'pageText']) $(id).textContent = '—';
      document.querySelectorAll('[data-bucket] span').forEach(node => { node.textContent = '—'; });
      $('rangeText').textContent = ''; $('collectionStatus').textContent = '자료 조회 실패 · 수집 상태 확인 불가';
    } finally {
      clearTimeout(timeout);
      if (serial === requestId) { loading = false; $('loading').hidden = true; controls(); }
    }
  }
  function formParams() {
    return new URLSearchParams({q: $('query').value.trim(), business: $('business').value, kind: $('kind').value, bucket, size: $('size').value, page: '1'});
  }
  let lastRequest = new URLSearchParams(applied);
  const request = params => { lastRequest = new URLSearchParams(params); return search(params); };
  $('searchForm').addEventListener('submit', event => { event.preventDefault(); request(formParams()); });
  for (const id of ['business', 'kind', 'size']) $(id).addEventListener('change', () => request(formParams()));
  document.querySelectorAll('[data-bucket]').forEach(button => button.addEventListener('click', () => { bucket = button.dataset.bucket; request(formParams()); }));
  $('reset').addEventListener('click', () => { $('query').value = ''; $('business').value = ''; $('kind').value = ''; bucket = 'current'; request(formParams()); });
  $('retry').addEventListener('click', () => request(lastRequest));
  $('refresh').addEventListener('click', () => request(applied));
  for (const [id, page] of [['first', () => 1], ['prev', () => result.page-1], ['next', () => result.page+1], ['last', () => result.pages]]) $(id).addEventListener('click', () => {
    if (!result || loading) return;
    const params = new URLSearchParams(applied); params.set('page', page()); request(params);
  });
  $('closeDetail').addEventListener('click', () => $('detail').close());
  $('copyLink').addEventListener('click', async () => {
    if (!copyReady || loading) return;
    const value = `${location.origin}/situation-room?${applied}`;
    try { await navigator.clipboard.writeText(value); notify('공개 상황실 링크를 복사했습니다.'); }
    catch { window.prompt('공개 상황실 주소', value); }
  });
  // Refresh only the last completed search; never submit an unfinished input draft.
  setInterval(() => {
    if (!document.hidden && !loading && result && !$('detail').open && !['INPUT', 'SELECT'].includes(document.activeElement?.tagName)) request(applied);
  }, 60000);
  window.addEventListener('pagehide', () => controller?.abort());
  icons(); request(applied);
})();
