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
    elem.innerHTML = this;
    return elem;
}
Element.prototype.setStyle = function(lists){
    for(let prop in lists){
        this.style[prop] = lists;
    }
}

location.getValue = function(){
    let result = {};
    let keyword = this.search;

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
    static loaded = new CustomEvent("loaded");
    constructor({dbname, tableList = [], version = 1} = {}){
        this.root = null;
        let req = indexedDB.open(dbname, version);
        req.onupgradeneeded = () => {
            let db = req.result;
            tableList.forEach(x => {
                db.createObjectStore(x, {keyPath: "id", autoIncrement: true});
            });
        }
        req.onsuccess = () => {
            this.root = req.result;
            window.dispatchEvent(Database.loaded);
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

    edit(table, data){
        let os = this.root.transaction(table, "readwrite").objectStore(table);
        os.put(data);
    }

    remove(table, id){
        let os = this.root.transaction(table, "readwrite").objectStore(table);
        os.remove(id);
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
     constructor(e){
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

        this.$elem.querySelector(".close").addEventListener("click", e => this.$elem.remove());
        this.$body = this.$elem.querySelector(".body");
        document.body.append(this.$elem);
     }

     editLogo(){
        this.$body.innerHTML = `<div class="logo-edit">
                                    <div class="form-group">
                                        <label for="i_logo">업로드</label>
                                        <input type="file" id="i_logo" class="form-control">
                                    </div>
                                    <div class="form-group">
                                        <label>이미지 선택</label>
                                        <div class="row">
                                            <img src="./images/logo/logo.png" title="logo" alt="logo" class="logo m-3" width="100">
                                            <img src="./images/logo/logo2.png" title="logo" alt="logo" class= "logo m-3" width="100">
                                            <img src="./images/logo/logo3.png" title="logo" alt="logo" class= "logo m-3" width="100">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <button class="btn btn-accept w-100">변경하기</button>
                                    </div>
                                </div>`;
        
        this.e_imageActive();
     }

     e_imageActive() {
        this.$body.querySelectorAll(".row > img").forEach((img, i, list) => {
            img.addEventListener("click", (e) => {
                
                Array.from(list).filter(x => x !== e.currentTarget).forEach(elem => {
                    console.log(elem);
                    elem.classList.remove("active");
                });
                e.currentTarget.classList.toggle("active");
            })
        });
     }
 }


/**
 * 페이지 관리자
 */
 class PageManage {
     constructor(){
         this.$root = document.querySelector("#page-manage");
         this.$popup = document.querySelector("#page-edit");
         this.$popid = this.$popup.querySelector("#site-id");

         this.$inputs = {};
         Array.from(this.$popup.querySelectorAll("input")).forEach(x => this.$inputs[x.name] = x);

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
                history.pushState({code: x.code}, null, "/teaser_builder.html?code="+x.code);
                app.update();
            });
            
            // 페이지 수정 팝업 열기
            elem.querySelector("button").addEventListener("click", e => {
                 this.$popid.value = x.id;
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
            let site = {name: "신규 페이지", title: "", description: "", keyword: "", code: await this.getUniequeSiteCode()};
            let lastInsertedId = await db.add("sites", site);
            let layout = {sid: lastInsertedId, viewList: ["Header_1", "Footer_1"]}
            db.add("layouts", layout);

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

            let list = await db.getAll("sites");

            let code = this.$inputs.code.value;
            if(/^([a-zA-Z0-9]+)$/.test(code) == false){
                alert("고유 코드는 [영문/숫자] 로만 작성할 수 있습니다.");
                return;
            }

            if(list.some(x => x.code === code)){
                alert("동일한 코드가 이미 존재합니다.");
                return;
            }

            let obj = {};
            Object.entries(this.$inputs).forEach(([key, input]) => obj[key] = IDBParse(input.value));
            db.edit("sites", obj);
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
        this.layout = await this.loadLayout();

        this.pageManage = new PageManage();

        let code = location.getValue().code || null;
        let sites = await db.getAll("sites");
        let find = sites.find(x => x.code === code);
        this.view_id = find ? find.id : null;

        this.$wrap = document.querySelector(".wrap");

        this.event();
        this.update();
    }

    async update(){
        if(!this.view_id) return;

        let cd = await db.get("sites", this.view_id); // current data
        let cv = await db.get("layouts", this.view_id); // current view

        document.title = cd.title;
        document.head.append( `<meta name="title" content="${cd.title}">`.toElem() );
        document.head.append( `<meta name="description" content="${cd.description}">`.toElem() );
        document.head.append( `<meta name="keyword" content="${cd.keyword}">`.toElem() );
        
        

        this.$wrap.innerHTML = "";
        cv.viewList.forEach(item => {
            this.$wrap.append(this.layout[item]);
        });
        
        localStorage.setItem("view_id", this.view_id);
    }

    event(){
        // Active 클래스 도글
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

        document.querySelectorAll("#page-create .preview-list .image").forEach(img => {
            img.addEventListener("click", async e => {
                if(this.view_id){
                    let filename = e.currentTarget.dataset.name;
                    let item = await db.get("layouts", this.view_id);
                    item.viewList.splice(item.viewList.length-1, 0, filename);
                    db.edit("layouts", item);
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

    loadLayout(){
        const layoutList = ["Header_1", "Contacts_1", "Contacts_2", "Features_1", "Features_2", "Gallery&Slide_1", "Gallery&Slide_2", "Visual_1", "Visual_2", "Footer_1"];
        return new Promise(async res => {
            let layout = {};

            let templates = await db.getAll("templates");
            if(templates.length > 0){
                templates.forEach(x => {
                    layout[x.name] = x.html.toElem();
                    layout[x.name].querySelectorAll(".has-context").forEach(item => {
                        item.addEventListener("contextmenu", e => {
                            this.contextMenu(e);
                        });
                    });
                });
            }
            else {
                let layoutArr = await Promise.all(layoutList
                                .map(async filename => await fetch(`/template/${filename}`)
                                .then(x => x.text())
                                .then(x => {
                                    x = x.toElemInDiv();
                                    x.querySelectorAll(".has-context").forEach(item => {
                                        item.addEventListener("contextmenu", e => {
                                            this.contextMenu(e);
                                        });
                                    });
                                    return x;
                                })));
    
                layoutList.forEach((item, i) => {
                    layout[item] = layoutArr[i];                
                });
                layoutArr.forEach((x, i) => {
                    db.add("templates", {name: layoutList[i], html: x.outerHTML});
                });
            }


            res(layout);
        });
    }

    contextMenu(e){
        e.preventDefault();
        e.stopPropagation();

        let overlap = document.querySelector(".context-menu");
        overlap && overlap.remove();

        let nameList = {
            "editLogo": "로고 변경",
            "editMenu": "메뉴 변경"
        };

        let menuList = e.currentTarget.dataset.context.split(" ");
        console.log(menuList);

        let {pageX, pageY} = e;
        let elem = "<div class='context-menu'></div>".toElem();

        menuList.forEach((fn, i) => {
            let item = document.createElement("div");
            item.innerText = nameList[fn];
            item.addEventListener("click", () => (new Editor(e))[fn]());
            elem.append(item);
        });

        elem.style.left = pageX + "px";
        elem.style.top = pageY + "px"

        document.body.append(elem);

    }
}

window.addEventListener("load", () => {
    const dbname = "BMIF";
    const tableList = ["sites", "layouts", "templates"];
    const version = 2;

    db = new Database({dbname, tableList, version});
    window.addEventListener("loaded", () => {
        app = new App();
    });
});