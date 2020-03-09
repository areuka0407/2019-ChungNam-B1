var app, db;

/* Helper
*/
function IDBParse(data){
    return /^([0-9]+)$/.test(data) ? parseInt(data) : data;
}

/**
 * Prototype
 */
String.prototype.toElem = function(){
    let elem = document.createElement("div");
    elem.innerHTML = this;
    return elem.firstElementChild;
}

String.prototype.toElemInDiv = function(){
    let elem = document.createElement("div");
    elem.classList.add("topper");
    elem.innerHTML = this;
    return elem;
}

String.prototype.rgbtohex = function(){
    let matches = /rgb\(\s*(?<red>[0-9]+)\s*,\s*(?<green>[0-9]+)\s*,\s*(?<blue>[0-9]+)\s*\)/.exec(this);
    let result = "";

    for(let key in matches.groups){
        let val = parseInt(matches.groups[key]);
        result += val.toHex();
    }

    return "#" + result;
}

Number.prototype.toHex = function(){
    let result = [];
    let _this = parseInt(this);
    
    while(_this > 0){
        result.push( transHex(_this % 16) );
        _this = parseInt(_this / 16);
    }

    return result.reverse().join("");
}
function transHex(num){
    switch(parseInt(num)){
        case 10: return "A";
        case 11: return "B";
        case 12: return "C";
        case 13: return "D";
        case 14: return "E";
        case 15: return "F";
        default: return num;
    }
}

Element.prototype.setStyle = function(lists){
    for(let prop in lists){
        this.style[prop] = lists;
    }
}


location.getValue = function(keyword = ""){
    let result = {};
    keyword = keyword === "" ?  this.search : keyword;

    while(/(?<key>[^&?]+)=(?<value>[^&?]+)/.test(keyword)){
        let matches = /(?<key>[^&?]+)=(?<value>[^&?]+)/.exec(keyword)
        result[matches.groups.key] = matches.groups.value;

        let text = matches[0];
        keyword = keyword.substr(keyword.indexOf(text) + text.length);
    }

    return result;
}


/**
 * DB
 */

class Database {
    constructor({dbname, tableList = [], version = 1} = {}){
        this.root = null;
        this.request = indexedDB.open(dbname, version);
        this.request.onupgradeneeded = () => {
            let db = this.request.result;
            tableList.forEach(x => {
                db.createObjectStore(x, {keyPath: "id", autoIncrement: false});
            });
        }
        this.request.onsuccess = () => {
            this.root = this.request.result;
        };
    }

    add(table, data){
        return new Promise(resolve => {
            let os = this.root.transaction(table, "readwrite").objectStore(table);
            let req = os.add(data);
            req.onsuccess = () => {
                resolve( req.result );
            }
        });
    }

    put(table, data){
        let os = this.root.transaction(table, "readwrite").objectStore(table);
        os.put(data);
    }

    remove(table, id){
        let os = this.root.transaction(table, "readwrite").objectStore(table);
        os.delete(id);
    }

    get(table, id){
        return new Promise(res => {
            let os = this.root.transaction(table, "readwrite").objectStore(table);
            let req = os.get(id);
            req.onsuccess = () => res( req.result );
        });
    }

    getAll(table){
        return new Promise(res => {
            let os = this.root.transaction(table, "readwrite").objectStore(table);
            let req = os.getAll();
            req.onsuccess = () => res( req.result );
        });
    }
}


/**
 * 편집자 - 팝업을 띄우며 페이지를 편집할 수 있게 해줌
 */

 class Editor {
     constructor({target, id}){
        this.edit_id = id;
        this.$root = target;


        this.parent = this.$root.parentElement;
        while(this.parent && !this.parent.classList.contains("topper")) this.parent = this.parent.parentElement;
        

        // 기존 요소는 삭제
        document.querySelectorAll(".popup").forEach(x => {
            x.remove();
        });

        this.$elem =    `<div class="popup">
                            <div class="header">
                                <div class="title">Editor</div>
                                <div class="close cursor">×</div>
                            </div>
                            <div class="body"></div>
                        </div>`.toElem();

        this.$elem.querySelector(".close").addEventListener("click", e => {
            this.$elem.remove();
            app.update();
        });
        this.$body = this.$elem.querySelector(".body");
        document.body.append(this.$elem);
     }

     // 이미지 수정 :: img 태그에 직접 걸지 말고, 감싸고 있는 태그에 적용할 것!
     async editImage({imagePath, imageLimit = 1, multiple = false}){
         
        this.$body.innerHTML = `<div class="logo-edit">
                                    <div class="form-group">
                                        <label for="i_image">업로드</label>
                                        <input type="file" id="i_image" class="form-control">
                                    </div>
                                    <div class="form-group">
                                        <label>이미지 선택</label>
                                        <div class="row">
                                    </div>
                                    <div class="form-group">
                                        <button class="btn btn-accept w-100">변경하기</button>
                                    </div>
                                </div>`;

        let $row =  this.$body.querySelector(".row");
        for(let i = 1; i <= parseInt(imageLimit); i++){
            let url = imagePath.replace("$", i);
            $row.append(`<div class="image m-3"><img src="${url}" title="이미지" alt="이미지"></div>`.toElem());
        }
        this.$body.querySelectorAll(".row > .image").forEach((x, i, list) => {
            x.addEventListener("click", () => this.e_imageActive(x, i, list, multiple));
        });

        this.$body.querySelector("#i_image").addEventListener("change", e => {
            let file = e.currentTarget.files.length > 0 && e.currentTarget.files[0];
            if(file){
                let reader = new FileReader();
                reader.onload = () =>{ 
                    let $imgList = this.$body.querySelectorAll(".row .image");
                    let $image = `<div class="image">
                                    <img src="${reader.result}" title="logo" alt="logo" width="100">
                                </div>`.toElem();
                    $image.addEventListener("click", () => {
                        this.e_imageActive($image, $imgList.length, $imgList, multiple);
                    });
                    $row.append($image);
                }
                reader.readAsDataURL(file);
            }
        });
    
        this.$body.querySelector(".btn-accept").addEventListener("click", async () => {
            await this.save();
            this.$elem.remove();
            app.update();
        }); 
     }

     // Nav 메뉴 수정
     async editMenu(){
        let template = await db.get("templates", this.edit_id);
        let $header = template.list.Header_1.toElemInDiv();
        let navItems = $header.querySelectorAll(".n-item > a");
        
        let html = `<form class="editMenu">`;
        for(let i = 1; i <=5; i++){
            let id = navItems[i-1] && location.getValue(navItems[i-1].href).id;
            let $options = (await db.getAll("sites")).map(site => `<option value="${site.id}" ${id == site.id ? "selected" : ""}>${site.name}(${site.id})</option>`).reduce((p, c) => p + c, "");
            html += `<div class="form-group">
                        <label for="mname_${i}">메뉴 ${i}</label>
                        <div class="d-flex justify-content-between">
                            <input type="text" id="mname_${i}" class="form-control w-30" placeholder="메뉴명" value="${navItems[i-1] ? navItems[i-1].innerText : ""}">
                            <select id="mhref_${i}" class="form-control w-70 ml-2">
                                <option value>연결 페이지</option>
                                ${$options}
                            </select>
                        </div>
                    </div>`;
        }
        html +=     `<button class="btn btn-accept w-100">변경하기</button>
                </form>`;
        this.$body.innerHTML = html;
        
        this.$body.querySelector(".editMenu").addEventListener("submit", e => {
            e.preventDefault();
            let $groups = Array.from(this.$body.querySelectorAll(".form-group > .d-flex")).map(x => ([x.firstElementChild, x.lastElementChild]));
            let $nav = $header.querySelector("nav");
            $nav.innerHTML = "";

            // 메뉴를 입력한게 3개 이상인지 검사
            if( $groups.map(([$input]) => $input.value).filter(x => x.trim() !== "").length < 3){
                return alert("메뉴는 3개 이상 존재해야합니다.");
            }
            
            $groups.forEach(([$input, $select]) => {
                let name = $input.value;
                let href = "/teaser_builder.html"+ ($select.value ? "?id="+$select.value : "");

                if(name && href){
                    $nav.innerHTML += `<div class="n-item"><a href="${href}">${name}</a></div>`;
                }
            });
            template.list.Header_1 = $header.innerHTML;
            db.put("templates", template);
            app.update();
            this.$elem.remove();
        });
        
     }

     // 보이기 / 감추기
     showhide(){
        if(this.$root.style.visibility === "hidden") {
            this.$root.classList.remove("showhide-active");
            this.$root.style.visibility = "visible";
        }
        else {
            this.$root.classList.add("showhide-active");
            this.$root.style.visibility = "hidden";
        }
        
        this.save();
        this.$elem.remove();
     }

     // 텍스트 스타일 변경
     textStyle(){
        let textColor = $(this.$root).css("color");
        let textSize = parseInt($(this.$root).css("font-size"));
        this.$body.innerHTML = `<form class="textStyle">
                                    <div class="form-group">
                                        <label for="text-color">텍스트 색상</label>
                                        <input type="color" id="text-color" name="color" value=${textColor.rgbtohex()}>
                                    </div>
                                    <div class="form-group">
                                        <label for="text-size">텍스트 크기</label>
                                        <input type="number" id="text-size" name="fontSize" style="width: 50px" value="${textSize}">
                                        <span>px</span>
                                    </div>
                                    <div class="form-group">
                                        <button class="btn btn-accept w-100 mt-5">변경하기</button>
                                    </div>
                                </form>`;
        this.$body.querySelector("form.textStyle").addEventListener("submit", e => {
            e.preventDefault();

            this.$root.style.fontSize = this.$body.querySelector("#text-size").value + "px";
            this.$root.style.color = this.$body.querySelector("#text-color").value;

            this.save().then(() => {
                this.$elem.remove();
                app.update();
            });
        });
     }

     
     // 이미지를 클릭할 때 Active 토글을 거는 함수
     e_imageActive(target, i, list, multiple = false) {
        if(multiple == false){
            Array.from(list).filter(x => x !== target).forEach(elem => {
                elem.classList.remove("active");
            });
        }
        target.classList.toggle("active");


        let selected = Array.from(this.$body.querySelectorAll(".row .image.active > img"));
        let sample = this.$root.firstElementChild.outerHTML;

        this.$root.innerHTML = selected.map(sel => {
            return sample.replace(/(<img[^>]*src=")([^'"]+)("[^>]*>)/g, `$1${sel.src}$3`);
        }).join("");


        if(this.parent.dataset.name === "Visual_1") app.makeSlide1(this.parent)
        else if(this.parent.dataset.name === "Visual_2") app.makeSlide2(this.parent)
     }

     /**
      * IDB에 저장
      */
     async save(){
        let template = await db.get("templates", this.edit_id);
        template.list[this.parent.dataset.name] = this.parent.innerHTML;
        await db.put("templates", template);
     }
 }


/**
 * 페이지 관리자
 */
 class PageManage {
     constructor(){
         this.$root = document.querySelector("#page-manage");
         this.$popup = document.querySelector("#page-edit");
         this.$prev_id = this.$popup.querySelector("#prev-id");

         this.$inputs = {};
         Array.from(this.$popup.querySelectorAll(".form-control")).forEach(x => this.$inputs[x.name] = x);

         this.event();
         this.update();
     }

     async update(){
         let sites = await db.getAll("sites");
         let $tbody = this.$root.querySelector("table tbody");

         $tbody.innerHTML = "";
         sites.forEach(x => {
             let elem = document.createElement("tr");
             elem.dataset.id = x.id;
             app.view_id == x.id && elem.classList.add("active");
             elem.innerHTML =  `<td>${x.name}</td>
                                <td>${x.title}</td>
                                <td colspan="2">${x.description}</td>
                                <td>${x.keyword}</td>
                                <td><button class="btn mr-4 p-1">페이지수정</button></td>`;

            // 미리보기 활성화
            elem.addEventListener("click", e => {
                let exist = $tbody.querySelector("tr.active");
                exist && exist.classList.remove("active");
                e.currentTarget.classList.add("active");
                app.view_id = x.id;
                history.pushState({id: x.id}, null, "/teaser_builder.html?id="+x.id);
                app.update();
            });
            
            // 페이지 수정 팝업 열기
            elem.querySelector("button").addEventListener("click", e => {
                 this.$prev_id.value = x.id;
                 this.$popup.classList.add("active");

                 Object.keys(this.$inputs).forEach(key => {
                    this.$inputs[key].value = x[key];
                 });
                 
                 e.stopPropagation();
            });
            $tbody.append(elem);
         });
         
     }

     event(){
         // 새 사이트 생성
         this.$root.querySelector(".btn-add").addEventListener("click", async () => {
            let code = await this.getUniequeSiteCode();
            let site = {name: "신규 페이지", title: "", description: "", keyword: "", id: code};
            db.add("sites", site);

            let layout = {id: code, viewList: ["Header_1", "Footer_1"]}
            db.add("layouts", layout);

            let t_list = ['Header_1', 'Visual_1', 'Visual_2', 'Contacts_1', 'Contacts_2', 'Gallery&Slide_1', 'Gallery&Slide_2', 'Features_1', 'Features_2', 'Footer_1']; // 템플릿 리스트
            let template = {id: code, list: {}};
            await Promise.all(
                t_list.map(async filename => {
                    template.list[filename] = await fetch("/template/" + filename).then(x => x.text());
                })
            );
            

            
            db.add("templates", template);

            this.update();
         });

         // 팝업창 닫기
         window.addEventListener("click", e => {
            if(this.$popup.classList.contains("active")){
                let children = Array.from(this.$popup.querySelectorAll(e.target.nodeName));
                e.target !== this.$popup && children.includes(e.target) == false && this.$popup.classList.remove("active");
            }
         });

         // 데이터 수정
         this.$popup.querySelector("form").addEventListener("submit", async e => {
            e.preventDefault();

            let prev_id = this.$prev_id.value;

            let id = this.$inputs.id.value;
            if(/^([a-zA-Z0-9]+)$/.test(id) == false){
                alert("고유 코드는 [영문/숫자] 로만 작성할 수 있습니다.");
                return;
            }

            let overlap = await db.get("sites", id);
            if(overlap && id !== prev_id){
                alert("동일한 코드가 이미 존재합니다.");
                return;
            }

            let site = {};
            Object.entries(this.$inputs).forEach(([key, input]) => site[key] = input.value);

            // 아이디를 변경했을 경우
            if(id !== prev_id){
                let [template, layout] = await Promise.all([
                    db.get("templates", prev_id),
                    db.get("layouts", prev_id),
                    db.remove("sites", prev_id),
                    db.remove("layouts", prev_id), 
                    db.remove("templates", prev_id)
                ]);

                template.id = id;
                layout.id = id;

                db.add("templates", template);
                db.add("layouts", layout);
                db.add("sites", site);
            }
            // 변경하지 않았을 경우
            else db.put("sites", site);

            this.$popup.classList.remove("active");
            this.update();
         });
     }

     getUniequeSiteCode(){
         return new Promise(res => {
            db.getAll("sites").then(list => {
                let str = "1234567890qwertyuiopasdfghjklzxcvbnm", result;
                do {
                    result = "";
                    for(let i = 0; i < 10; i++){
                        result += str[ parseInt(Math.random() * 11) ];
                    }
                } while(list.some(x => x.code === result));
                res(result);
            });
         });
    }
 }

/**
 * App
 */

class App {
    constructor(){
        this.init();    
    }

    async init(){   
        this.pageManage = new PageManage();

        this.view_id = location.getValue().id || null;
        this.$wrap = document.querySelector(".wrap");

        this.event();
        this.update();
    }

    async update(){
        if(!this.view_id) return;

        let [cd, cv, ct] = await Promise.all([
            db.get("sites", this.view_id),
            db.get("layouts", this.view_id),
            db.get("templates", this.view_id)
        ]);

        if(! (cd && cv && ct)) return alert("해당 페이지를 찾을 수 없습니다.");

        document.title = cd.title;
        document.head.append( `<meta name="title" content="${cd.title}">`.toElem() );
        document.head.append( `<meta name="description" content="${cd.description}">`.toElem() );
        document.head.append( `<meta name="keyword" content="${cd.keyword}">`.toElem() );

        this.$wrap.innerHTML = "";

        let id = this.view_id;
        cv.viewList.forEach(key => {
            let elem = ct.list[key].toElemInDiv();
            elem.dataset.name = key;
            elem.querySelectorAll(".has-context").forEach(x => x.addEventListener("contextmenu", event => this.contextMenu({event, id})));
            this.$wrap.append(elem);
            
            if(key === "Visual_1") this.makeSlide1(elem);
            if(key === "Visual_2") this.makeSlide2(elem);
        });
        
        localStorage.setItem("view_id", this.view_id);
    }

    event(){
        // Active 클래스 토글
        let needToggleActive = ["#open-manage", "#open-create", "#page-create .tool .name"];
        needToggleActive.forEach(select => {
            document.querySelectorAll(select).forEach((elem, i, list) => {
                elem.addEventListener("click", e => {
                    let exist = Array.from(list).find(x => x !== elem && x.classList.contains("active"));
                    exist && exist.classList.remove("active");
                    e.currentTarget.classList.toggle("active");
                });
            });
        });

        // 페이지 제작 레이아웃
        document.querySelectorAll("#page-create .preview-list .image").forEach(img => {
            img.addEventListener("click", async e => {
                if(this.view_id){
                    let filename = e.currentTarget.dataset.name;
                    let item = await db.get("layouts", this.view_id);
                    item.viewList.splice(item.viewList.length-1, 0, filename);
                    db.put("layouts", item);
                    this.update();
                }
            });
        });


        // 콘텍스트 삭제
        document.body.addEventListener("click", e => {
            let exist = document.querySelector(".context-menu");
            exist && exist.remove();
        });
        window.addEventListener("scroll", e => {
            let exist = document.querySelector(".context-menu");
            exist && exist.remove();
        });
    }

    makeSlide1(elem){
        elem.animated && clearInterval(elem.animated);

        let cs = 0; // current slide
        let container = elem.querySelector(".images > div");
        let images = elem.querySelectorAll(".image"); // 기존 이미지 배열

        images.forEach((x, i) => {
            x.dataset.no = i;
        });
        
        if(images.length < 2) {
            $(container).css("top", "0");
            return;
        }

        let lastClone = images[images.length - 1].cloneNode(true);
        container.prepend(lastClone);
        let firstClone = images[0].cloneNode(true);
        container.append(firstClone);
        let secondClone = images[1].cloneNode(true);
        container.append(secondClone);


        let _images = elem.querySelectorAll(".image"); // 클론까지 추가한 이미지 배열
        $(container).css("height", _images.length * 100 + "%");

        let i_height = container.offsetHeight / _images.length;

        $(_images).css({
            transform: "scale(0.8)",
            opacity: "0.5",
            transition: "1s",
            height: i_height + "px"
        })
        $(_images).eq(1).css({transform: "scale(1)", opacity: "1"})

        
        $(container).css("top", `-${i_height}px`);
    
        elem.animated = setInterval(() => {
            cs++;
            $(_images).css({transform: "scale(0.8)", opacity: "0.5"});
            $(elem.querySelectorAll(`.image[data-no="${cs >= images.length ? 0 : cs}"]`)).css({transform: "scale(1)", opacity: "1"});
            $(container).animate({top: `${-i_height + i_height * -cs}px`}, 1000, () => {
                if(cs + 1 > images.length){
                    $(container).css("top", `-${i_height}px`);
                    cs = 0;
                }
            });
        }, 3000);

    }   

    makeSlide2(elem){
        elem.animated && clearInterval(elem.animated);

        let cs = 0;

        let images = elem.querySelectorAll(".images > img");

        if(images.length < 2) {
            $(images).fadeIn();
            return;
        }

        $(images).not(`:eq(0)`).fadeOut();

        elem.animated = setInterval(() => {
            let ns = cs + 1 >= images.length ? 0 : cs + 1;
            $(images).eq(cs).fadeOut(1000);
            $(images).eq(ns).fadeIn(1000);

            cs = cs + 1 >= images.length ? 0 : cs + 1;
        }, 3000);
    }

    contextMenu({event, id}){
        event.preventDefault();
        event.stopPropagation();

        let target = event.currentTarget;
        let overlap = document.querySelector(".context-menu");
        overlap && overlap.remove();

        let imageAction = ["editLogo", "editSlide"];
        let nameList = {
            "editLogo": "로고 변경",
            "editMenu": "메뉴 변경",
            "showhide": "보이기/감추기",
            "editSlide": "슬라이드 이미지 변경",
            "textStyle": "텍스트 색상/크기 변경",
            "editLink": "링크 변경"
        };

        let menuList = target.dataset.context ? target.dataset.context.split(" ") : [];
        let hideItems = target.querySelectorAll(".showhide-active");

        let {clientX, clientY} = event;
        let elem = "<div class='context-menu'></div>".toElem();

        
        menuList.forEach((fn, i) => {
            let item = document.createElement("div");
            item.innerText = nameList[fn];
            item.addEventListener("click", e => {
                let editor = new Editor({target, id});
                ! imageAction.includes(fn) ? editor[fn]() : editor.editImage({
                    imagePath: target.dataset.path,
                    imageLimit: parseInt(target.dataset.limit),
                    multiple: target.dataset.multiple
                });
            });
            elem.append(item);
        });

        hideItems.forEach(hi => {
            let item = document.createElement("div");
            item.innerText = hi.dataset.name + " 보이기";
            item.addEventListener("click", e => {
                let editor = new Editor({id, target: hi});
                editor.showhide();
            });
            elem.append(item);
        });

        elem.style.left = clientX + "px";
        elem.style.top = clientY + "px"

        if(menuList.length + hideItems.length > 0)
            document.body.append(elem);

    }
}

window.addEventListener("load", () => {
    const dbname = "BMIF";
    const tableList = ["sites", "layouts", "templates"];
    const version = 2;

    db = new Database({dbname, tableList, version});
    db.request.addEventListener("success", () => {
        app = new App();
    });
});