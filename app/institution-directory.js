(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n).toLocaleString("ko-KR");
  const icons = () => window.lucide?.createIcons();
  const labels = {"alio":"ALIO 공공기관","local-enterprise":"지방공기업","local-invested":"출자·출연기관","government-local":"지방자치단체","education":"교육청","government-central":"정부부처"};
  let data = null, category = "", page = 1, controller = null, serial = 0, toastTimer, appliedParams = null;
  function node(tag, text, cls) { const el = document.createElement(tag); if(text !== undefined) el.textContent=text; if(cls) el.className=cls; return el; }
  function icon(name) { const el=node("i");el.dataset.lucide=name;el.setAttribute("aria-hidden","true");return el; }
  function link(label, url, cls) {
    try { const parsed=new URL(url);if(!["http:","https:"].includes(parsed.protocol)||parsed.username||parsed.password)return null; }
    catch { return null; }
    const el=node("a",label,cls);el.href=url;el.target="_blank";el.rel="noopener noreferrer";el.append(icon("arrow-up-right"));return el;
  }
  function toast(text) {clearTimeout(toastTimer);$("toast").textContent=text;$("toast").hidden=false;toastTimer=setTimeout(()=>$("toast").hidden=true,3500);}
  function optionList(id, options, selected, allLabel) {
    const select=$(id);select.replaceChildren(new Option(allLabel,""));
    for(const [value,label] of options)select.add(new Option(label,value));
    if(selected&&!options.some(([value])=>value===selected))select.add(new Option(selected,selected));
    select.value=selected;
  }
  function params() {
    const p=new URLSearchParams();
    for(const [k,v] of Object.entries({q:$("query").value.trim(),category,region:$("region").value,authority:$("authority").value,page:String(page),size:$("size").value}))if(v)p.set(k,v);
    return p;
  }
  function setPager(busy=false) {
    $("first").disabled=$("prev").disabled=busy||!data||data.page<=1;
    $("next").disabled=$("last").disabled=busy||!data||data.page>=data.pages;
  }
  function details(row) {
    $("detailTitle").textContent=row.name;$("detailCategory").textContent=labels[row.category];
    const count=row.nps_count===null?"미연결 (0명 아님)":`${fmt(row.nps_count)}명 · ${row.nps_month||"자료월 미확인"}`;
    const fields=[["기관 유형",row.type],["소관·상위 기관",row.authority],["소재 지역",row.region],["주소",row.address],["다른 표기",row.aliases.join(" · ")],["국민연금 가입자",row.nps_status==="조회 대상 아님"?"미제공":count],["가입자 연결 상태",row.nps_status],["기관코드",row.id],["명단 기준일",row.basis_date],["출처 확인일",row.verified_at],["확인 내용",row.note]];
    $("detailFields").replaceChildren();
    for(const [label,value]of fields)$("detailFields").append(node("dt",label),node("dd",value||"미제공"));
    $("detailLinks").replaceChildren();
    for(const el of [link("공식 출처",row.source_url),link("기관 홈페이지",row.website)])if(el)$("detailLinks").append(el);
    icons();$("detail").showModal();
  }
  function render(result, submitted) {
    data=result;page=result.page;
    $("catalogTotal").textContent=fmt(result.catalog_total);$("checkedDate").textContent=`${result.verified_from} ~\n${result.verified_to} 확인`;
    $("resultCount").textContent=`${fmt(result.total)}건`;
    $("categoryTabs").replaceChildren();
    for(const [id,label]of [["","전체"],...Object.entries(labels)]) {
      const button=node("button",label);button.type="button";button.dataset.category=id;button.setAttribute("aria-pressed",String(category===id));
      button.append(node("span",fmt(id?result.counts[id]:result.catalog_total)));$("categoryTabs").append(button);
    }
    optionList("region",result.regions.map(r=>[r,r]),result.selected_region||"","전체 지역");
    optionList("authority",result.authorities.map(r=>[r.name,`${r.name} (${fmt(r.count)})`]),$("authority").value,"전체 소관");
    $("results").replaceChildren();
    for(const row of result.items) {
      const tr=node("tr");
      const first=node("td");first.dataset.label="기관명";
      const button=node("button",row.name,"institution-name");button.type="button";button.addEventListener("click",()=>details(row));first.append(button);
      if(row.address)first.append(node("span",row.address,"subline"));
      tr.append(first);
      for(const [label,text,cls]of [["기관 유형",row.type,"type-label"],["소관·상위 기관",row.authority||"미제공",""],["소재 지역",row.region||"전국 / 미제공",""]]) {const td=node("td");td.dataset.label=label;td.append(node("span",text,cls));tr.append(td);}
      const nps=node("td");nps.dataset.label="국민연금 가입자";
      if(row.nps_count!==null){nps.append(node("span",`${fmt(row.nps_count)}명`,"nps-value"),node("span",`${row.nps_month||"자료월 미확인"} 기준`,"subline"));}
      else nps.append(node("span",row.nps_status==="조회 대상 아님"?"미제공":"미연결"),node("span",row.nps_status==="조회 대상 아님"?"가입자수 미수록":"0명으로 집계하지 않음","subline"));
      const source=node("td");source.dataset.label="공식 출처";const a=link(row.source,row.source_url,"source-link");if(a)source.append(a);source.append(node("span",`${row.verified_at} 확인`,"subline"));tr.append(nps,source);$("results").append(tr);
    }
    $("empty").hidden=!!result.total;$("tableWrap").hidden=!result.total;
    $("pageText").textContent=`${fmt(page)} / ${fmt(result.pages)}`;
    $("rangeText").textContent=result.total?`${fmt((page-1)*result.size+1)}–${fmt(Math.min(page*result.size,result.total))} / 전체 ${fmt(result.total)}건`:"수록 목록 내 검색 결과 0건";
    $("scopeNote").textContent=result.scope_note;$("sourceDate").textContent=`${result.verified_from} ~ ${result.verified_to} 확인`;
    $("staleNote").hidden=!result.stale;$("sources").replaceChildren();
    for(const source of result.sources){const li=node("li");const a=link(source.name,source.url,"source-link");if(a)li.append(a);li.append(document.createTextNode(` · ${fmt(source.count)}건 · ${source.verified_at} 확인`));$("sources").append(li);}
    appliedParams=new URLSearchParams(submitted);appliedParams.set("page",String(page));
    if(result.selected_region)appliedParams.set("region",result.selected_region);else appliedParams.delete("region");
    history.replaceState(null,"",`/institutions?${appliedParams}`);icons();setPager();
  }
  async function search(useApplied=false) {
    const request=++serial;const submitted=useApplied===true&&appliedParams?new URLSearchParams(appliedParams):params();
    submitted.set("page",String(page));controller?.abort();controller=new AbortController();
    const current=controller;let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;current.abort();},12000);
    $("loading").hidden=false;$("error").hidden=true;$("empty").hidden=true;$("tableWrap").hidden=true;
    $("searchButton").setAttribute("aria-busy","true");$("resultCount").textContent="조회 중";$("rangeText").textContent="";setPager(true);
    $("copyLink").disabled=true;
    try {
      const response=await fetch(`/api/public/institutions?${submitted}`,{signal:current.signal,credentials:"omit",cache:"no-store"});
      const result=await response.json();if(request!==serial)return;
      if(!response.ok||result.status!=="ok"||!Array.isArray(result.items))throw new Error(result.error||"기관 목록 응답을 확인하지 못했습니다. 검색 결과 0건이 아닙니다.");
      render(result, submitted);$("copyLink").disabled=false;
    }catch(error){
      if(request!==serial)return;
      data=null;appliedParams=null;$("results").replaceChildren();$("tableWrap").hidden=true;$("error").hidden=false;
      $("errorText").textContent=timedOut?"응답 시간이 초과되었습니다. 검색 결과 0건이 아닙니다. 다시 조회해 주세요.":error instanceof SyntaxError?"서버 응답을 확인하지 못했습니다. 검색 결과 0건이 아닙니다. 다시 조회해 주세요.":error instanceof TypeError?"서버 연결을 확인하지 못했습니다. 인터넷 연결을 확인하고 다시 조회해 주세요. 검색 결과 0건이 아닙니다.":error.message||"기관 목록 조회에 실패했습니다.";
      $("resultCount").textContent="조회 실패";$("pageText").textContent="—";setPager(true);
    }finally{clearTimeout(timeout);if(request===serial){$("loading").hidden=true;$("searchButton").removeAttribute("aria-busy");}}
  }
  function readUrl(){const p=new URLSearchParams(location.search);category=p.get("category")||"";$("query").value=(p.get("q")||"").slice(0,120);page=Math.max(1,Number(p.get("page"))||1);$("size").value=["25","50","100"].includes(p.get("size"))?p.get("size"):"25";for(const id of ["region","authority"])optionList(id,[],p.get(id)||"",id==="region"?"전체 지역":"전체 소관");}
  $("searchForm").addEventListener("submit",event=>{event.preventDefault();page=1;search();});
  $("categoryTabs").addEventListener("click",event=>{const button=event.target.closest("button[data-category]");if(button){category=button.dataset.category;page=1;$("authority").value="";search();}});
  for(const id of ["region","authority","size"])$(id).addEventListener("change",()=>{page=1;if(id==="region")$("authority").value="";search();});
  $("reset").addEventListener("click",()=>{category="";page=1;$("query").value="";$("region").value="";$("authority").value="";search();});
  for(const [id,target]of [["first",()=>1],["prev",()=>page-1],["next",()=>page+1],["last",()=>data.pages]])$(id).addEventListener("click",()=>{if(data){page=target();search(true);$("resultTitle").scrollIntoView({block:"start"});}});
  $("retry").addEventListener("click",search);$("closeDetail").addEventListener("click",()=>$("detail").close());
  $("copyLink").addEventListener("click",async()=>{if(!appliedParams)return;try{const url=new URL("/institutions",location.origin);url.search=appliedParams.toString();await navigator.clipboard.writeText(url.href);toast("검색 링크를 복사했습니다.");}catch{toast("복사 권한이 없습니다. 브라우저 주소를 복사해 주세요.");}});
  window.addEventListener("popstate",()=>{readUrl();search();});
  readUrl();icons();search();
})();
