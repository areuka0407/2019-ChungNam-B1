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
        result += val == 0 ? "0" : val.toHex();
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
    constructor({dbname, version = 1} = {}){
        this.root = null;
        this.request = indexedDB.open(dbname, version);
        this.request.onupgradeneeded = () => {
            let db = this.request.result;

            // Code 로 관리
            db.createObjectStore("sites", {keyPath: "code", autoIncrement: false});
            db.createObjectStore("layouts", {keyPath: "code", autoIncrement: false});

            // id 로 관리
            db.createObjectStore("templates", {keyPath: "id", autoIncrement: true});
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
     constructor({target, code}){
        this.editCode = code;
        this.$root = target;


        this.parent = $(this.$root).closest(".topper")[0];

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
        this.sample = this.$root.children[0].classList.contains("isClone") ? this.$root.children[1].outerHTML : this.$root.children[0].outerHTML;
        this.$body.innerHTML = `<div class="logo-edit">
                                    <div class="form-group">
                                        <label for="i_image">업로드</label>
                                        <input type="file" id="i_image" class="form-control">
                                    </div>
                                    <div class="form-group">
                                        <label>이미지 선택</label>
                                        <div class="row"></div>
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
    
        this.$body.querySelector(".btn-accept").addEventListener("click", () => {
            if(this.$body.querySelector(".row > .image.active")) {
                this.save().then(x => {
                    this.$elem.remove();
                });
            }
            else this.$elem.remove();
        }); 
     }

     // Nav 메뉴 수정
     async editMenu(){
        let navItems = this.parent.querySelectorAll(".n-item > a");
        
        let html = `<form class="editMenu">`;
        for(let i = 1; i <=5; i++){
            let code = navItems[i-1] && location.getValue(navItems[i-1].href).code;
            let $options = (await db.getAll("sites")).map(site => `<option value="${site.code}" ${code == site.code ? "selected" : ""}>${site.name}(${site.code})</option>`).reduce((p, c) => p + c, "");
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
        
        const update = () => {
            let $groups = Array.from(this.$body.querySelectorAll(".form-group > .d-flex")).map(x => ([x.firstElementChild, x.lastElementChild]));
            let $nav = this.parent.querySelector("nav");
            $nav.innerHTML = "";
            $groups.forEach(([$input, $select]) => {
                let name = $input.value;
                let href = "/teaser_builder.html"+ ($select.value ? "?code="+$select.value : "");

                if(name && href){
                    $nav.innerHTML += `<div class="n-item"><a href="${href}">${name}</a></div>`;
                }
            });
        };

        this.$body.querySelectorAll("input, select").forEach(($input, i) => {
            $input.addEventListener("input", e => update());
        });

        this.$body.querySelector(".editMenu").addEventListener("submit", e => {
            e.preventDefault();

            // 메뉴를 입력한게 3개 이상인지 검사
            let $groups = Array.from(this.$body.querySelectorAll(".form-group > .d-flex")).map(x => ([x.firstElementChild, x.lastElementChild]));
            if( $groups.map(([$input]) => $input.value).filter(x => x.trim() !== "").length < 3){
                return alert("메뉴는 3개 이상 존재해야합니다.");
            }
            
            this.save();
            this.$elem.remove();
        });
        
     }

     // 텍스트 수정
     editText(){
        let contents = this.$root.innerText;
        this.$body.innerHTML = `<form class="editText">
                                    <div class="form-group">
                                        <label for="text-contents">텍스트</label>
                                        <textarea id="text-contents" class="form-control" rows="5">${contents}</textarea>
                                    </div>
                                    <div class="form-group">
                                        <button class="btn btn-accept w-100 mt-5">변경하기</button>
                                    </div>
                                </form>`;
        this.$body.querySelector("#text-contents").addEventListener("input", e => {
            this.$root.innerText = e.target.value;
        });
        this.$body.querySelector(".editText").addEventListener("submit", e => {
            e.preventDefault();
            this.save().then(() => {
                this.$elem.remove();
            });
        });
        
     }

     // 텍스트 스타일 변경
     textStyle(){
        let textColor = getComputedStyle(this.$root).getPropertyValue("color");
        let textSize = parseInt($(this.$root).css("font-size"));
        this.$body.innerHTML = `<form class="textStyle">
                                    <div class="form-group">
                                        <label for="text-color">텍스트 색상</label>
                                        <input type="text" id="text-color" name="color" class="form-control" value=${textColor.rgbtohex()} placeholder="hex, rgb, naming 등의 색상 표현식을 작성하세요">
                                    </div>
                                    <div class="form-group">
                                        <label for="text-size">텍스트 크기</label>
                                        <div class="d-flex">
                                            <input type="number" id="text-size" name="fontSize" class="form-control p-1" style="width: 50px" value="${textSize}">
                                            <span>px</span>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <button class="btn btn-accept w-100 mt-5">변경하기</button>
                                    </div>
                                </form>`;
        this.$body.querySelector("#text-color").addEventListener("input", e => {
            this.$root.style.color = e.target.value;
        });
        this.$body.querySelector("#text-size").addEventListener("input", e => {
            this.$root.style.fontSize = this.$body.querySelector("#text-size").value + "px";
        });

        this.$body.querySelector("form.textStyle").addEventListener("submit", e => {
            e.preventDefault();

            this.save().then(() => {
                this.$elem.remove();
            });
        });
     }

     // 링크 수정
     editLink(){
        let link = this.$root.href;
        this.$body.innerHTML = `<form class="editLink">
                                    <div class="form-group">
                                        <label for="linked-url">연결할 URL</label>
                                        <input type="url" id="linked-url" class="form-control" value="${link}">
                                    </div>
                                    <div class="form-group">
                                        <button class="btn btn-accept w-100 mt-5">변경하기</button>
                                    </div>
                                </form>`;
        this.$body.querySelector("#linked-url").addEventListener("input", e => {
            this.$root.href = e.target.value;
        });
        this.$body.querySelector(".editLink").addEventListener("submit", e => {
            e.preventDefault();
            this.save().then(() => {
                this.$elem.remove();
            });
        }); 
     }

     // 배경색 수정
     editBackground(){
        this.$body.innerHTML = `<form id="edit-background">
                                    <div class="form-group">
                                        <label for="color-picker">색상표</label>
                                        <select id="color-picker" class="form-control" multiple>
                                            <option value="#eb3636" style="background-color: #eb3636">RED</option>
                                            <option value="#ebc136" style="background-color: #ebc136">YELLOW</option>
                                            <option value="#33d63b" style="background-color: #33d63b">GREEN</option>
                                            <option value="#33d6ce" style="background-color: #33d6ce">CYAN</option>
                                            <option value="#337ad6" style="background-color: #337ad6">BLUE</option>
                                            <option value="#d633bb" style="background-color: #d633bb">MAGENTA</option>
                                            <option value="#404040" style="background-color: #404040">BLACK</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <button class="btn btn-accept w-100">변경하기</button>
                                    </div>
                                </form>`;
        this.$body.querySelector("#color-picker").addEventListener("input", e => {
            $(this.$root).attr("style", "--color: " + e.target.value);
        });
        this.$body.querySelector("form").addEventListener("submit", e => {
            e.preventDefault();
            this.save().then(() => {
                this.$elem.remove();
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

        this.$root.innerHTML = selected.map(sel => {
            return this.sample.replace(/(<img[^>]*src=")([^'"]+)("[^>]*>)/g, `$1${sel.src}$3`);
        }).join("");

        // 함께 수정할 이미지가 있으면 같이 수정한다
        let combined = this.$root.dataset.combine && document.querySelector(this.$root.dataset.combine);
        combined && $(combined).attr("src", selected[0].src);

        // HTML을 통째로 갈아끼우므로, 이벤트 재설정이 필요하다.
        let fn = this.parent.dataset.name.toLowerCase();
        app[fn] && app[fn](this.parent);
     }

     /**
      * IDB에 저장
      */
     async save(){
        let template = await db.get("templates", parseInt(this.parent.dataset.id));
        template.contents = this.parent.innerHTML;
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
         this.$prevCode = this.$popup.querySelector("#prev-code");

         this.$inputs = {};
         Array.from(this.$popup.querySelectorAll(".form-control")).forEach(x => this.$inputs[x.name] = x);

         this.event();
         this.update();
     }

     async update(){
         let sites = await db.getAll("sites");
         let $tbody = this.$root.querySelector("table tbody");

         $tbody.innerHTML = "";
         sites.sort((a, b) => a.created_at - b.created_at).forEach(x => {
             let elem = document.createElement("tr");
             elem.dataset.id = x.id;
             app.viewCode == x.id && elem.classList.add("active");
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
                app.viewCode = x.code;
                history.pushState({code: x.code}, null, "/teaser_builder.html?code="+x.code);
                app.update();
            });
            
            // 페이지 수정 팝업 열기
            elem.querySelector("button").addEventListener("click", e => {
                 this.$prevCode.value = x.code;
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
            let site = {name: "신규 페이지", title: "", description: "", keyword: "", code, created_at: new Date().toTimeString()};
            db.add("sites", site);

            let t_list = ['Header_1', 'Footer_1']; // 템플릿 리스트
            let templates = await Promise.all(
                t_list.map(filename => new Promise(res => {
                    fetch("/template/" + filename)
                    .then(x => x.text())
                    .then(data => db.add("templates", {name: filename, contents: data}))
                    .then(id => res(id));
                }))
            );

            let layout = {code, viewList: templates};
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

            let prevCode = this.$prevCode.value;

            let code = this.$inputs.code.value;
            if(/^([a-zA-Z0-9]+)$/.test(code) == false){
                alert("고유 코드는 [영문/숫자] 로만 작성할 수 있습니다.");
                return;
            }

            let overlap = await db.get("sites", code);
            if(overlap && code !== prevCode){
                alert("동일한 코드가 이미 존재합니다.");
                return;
            }

            let site = {};
            Object.entries(this.$inputs).forEach(([key, input]) => site[key] = input.value);

            // 아이디를 변경했을 경우
            if(code !== prevCode){
                let [layout] = await Promise.all([
                    db.get("layouts", prevCode),
                    db.remove("sites", prevCode),
                    db.remove("layouts", prevCode), 
                ]);

                layout.code = code;

                db.add("layouts", layout);
                db.add("sites", site);
            }
            // 변경하지 않았을 경우
            else db.put("sites", site);

            this.$popup.classList.remove("active");
            this.update();
            
            history.pushState({code}, null, "/teaser_builder.html?code="+code);
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

        this.viewCode = location.getValue().code || null;
        this.$wrap = document.querySelector(".wrap");

        this.event();
        this.update();
    }

    async update(){
        if(!this.viewCode) return;

        let [site, layout] = await Promise.all([
            db.get("sites", this.viewCode),
            db.get("layouts", this.viewCode),
        ]);

        if(! (site && layout)) return alert("해당 페이지를 찾을 수 없습니다.");

        document.title = site.title;
        document.head.append( `<meta name="title" content="${site.title}">`.toElem() );
        document.head.append( `<meta name="description" content="${site.description}">`.toElem() );
        document.head.append( `<meta name="keyword" content="${site.keyword}">`.toElem() );

        this.$wrap.innerHTML = "";

        let code = this.viewCode;
        await Promise.all(
            layout.viewList.map(async id => {
                let template = await db.get("templates", id);
                let elem = template.contents.toElemInDiv();
                elem.dataset.id = template.id;
                elem.dataset.name = template.name;
                elem.querySelectorAll(".has-context").forEach(x => x.addEventListener("contextmenu", event => this.contextMenu({event, code})));

                this.$wrap.append(elem);

                let fn = template.name.toLowerCase();
                this[fn] && this[fn](elem);
            })
        )
        
        localStorage.setItem("view_id", this.viewCode);
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
                if(this.viewCode){
                    let name = e.currentTarget.dataset.name;

                    // template 다운로드
                    let contents = await fetch("/template/"+name).then(x => x.text());
                    let id = await db.add("templates", {name, contents});

                    // layout 배열에 추가
                    let layout = await db.get("layouts", this.viewCode);
                    layout.viewList.splice(layout.viewList.length-1, 0, id);
                    db.put("layouts", layout);

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

    /**
     * 각 페이지별 이벤트 정리
     */

    visual_1(elem){
        elem.animated && clearInterval(elem.animated);

        elem.querySelectorAll(".isClone").forEach(x => x.remove());

        let cs = 0; // current slide
        let container = elem.querySelector(".images > div");
        let images = elem.querySelectorAll(".image"); // 기존 이미지 배열

        $(container).css("top", "0");
        images.forEach((x, i) => {
            x.dataset.no = i;
        });
        
        if(images.length < 2) return; 
        

        let lastClone = images[images.length - 1].outerHTML.toElem();
        lastClone.classList.add("isClone");
        container.prepend(lastClone);

        let firstClone = images[0].outerHTML.toElem();
        firstClone.classList.add("isClone");
        container.append(firstClone);

        let secondClone = images[1].outerHTML.toElem();
        secondClone.classList.add("isClone");
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

    visual_2(elem){
        elem.animated && clearInterval(elem.animated);

        let cs = 0;

        let images = elem.querySelectorAll(".images > img");
        $(images).css({
            opacity: "1",
            display: "block"
        });

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

    gallery_1 = elem => this.gallery(elem);
    gallery_2 = elem => this.gallery(elem);

    gallery(elem){
        elem.querySelectorAll(".image").forEach(x => {
            x.addEventListener("mousedown", e => {
                if(e.which === 1) document.querySelector("#image-shower img").src = e.currentTarget.querySelector("img").src;
            });
            x.addEventListener("contextmenu", e => {
                e.preventDefault();
                e.stopPropagation();

                let editor = new Editor({target: x, code: this.viewCode});
                editor.editImage({
                    imagePath: x.dataset.path,
                    imageLimit: parseInt(x.dataset.limit),
                    multiple: x.dataset.multiple
                });   
            });
        });
    }

   
    contextMenu({event, code}){
        event.preventDefault();
        event.stopPropagation();

        let target = event.currentTarget;
        let overlap = document.querySelector(".context-menu");
        overlap && overlap.remove();

        let imageAction = ["editLogo", "editSlide", "editIcon", "editImage"];
        let nameList = {
            "editLogo": "로고 변경",
            "editMenu": "메뉴 변경",
            "showhide": "보이기/감추기",
            "editSlide": "슬라이드 이미지 변경",
            "textStyle": "텍스트 색상/크기 변경",
            "editText": "텍스트 수정",
            "editLink": "링크 변경",
            "editIcon": "아이콘 변경",
            "removeLayout": "레이아웃 삭제",
            "editImage": "이미지 수정",
            "editBackground": "배경색 수정",
        };

        let menuList = target.dataset.context ? target.dataset.context.split(" ") : [];

        let {clientX, clientY} = event;
        let elem = "<div class='context-menu'></div>".toElem();

        
        menuList.forEach((fn, i) => {
            // 요소 일괄 보이기/감추기 
            if(fn === "showhide"){ 
                let hidableItem =  Array.from(target.querySelectorAll("*[data-hidable]"))
                                .reduce((arr, item) => {
                                    let idx = arr.findIndex(inarr => Array.isArray(inarr) && inarr[0].dataset.name == item.dataset.name);
                                    idx < 0 ? arr.push([item]) : arr[idx].push(item);
                                    return arr;
                                }, []);
                hidableItem.forEach(item => {
                    let $item = `<div>${item[0].dataset.name} ${nameList[fn]}</div>`.toElem();
                    $item.addEventListener("click", async e => {
                        let isHide = item.some(x => x.classList.contains("hidden"));
                        if(isHide) item.forEach(x => x.classList.remove("hidden"));
                        else item.forEach(x => x.classList.add("hidden"));
                        
                        let parent = $(target).closest(".topper");
                        let id = parent.data("id");
                        let template = await db.get("templates", parseInt(id));
                        template.contents = parent.html();
                        await db.put("templates", template);
                    });
                    elem.append($item);
                });
            }
            // 그 외
            else {
                let item = document.createElement("div");
                item.innerText = nameList[fn];
                item.addEventListener("click", async e => {
                    // 이미지일 경우
                    if(imageAction.includes(fn)){
                        let editor = new Editor({target, code});
                        editor.editImage({
                            imagePath: target.dataset.path,
                            imageLimit: parseInt(target.dataset.limit),
                            multiple: target.dataset.multiple
                        });   
                    }
                    // 레이아웃 삭제
                    else if(fn === "removeLayout"){
                        let parent = $(target).closest(".topper")[0];
                        if(!confirm("정말 삭제하시겠습니까?")) return;
                        
                        let layout = await db.get("layouts", code);
                        let idx = layout.viewList.findIndex(x => x == parent.dataset.id)
                        layout.viewList.splice(idx, 1);
                        await db.put("layouts", layout);
                        this.update();
                    } 
                    // 일반
                    else {
                        let editor = new Editor({target, code});
                        editor[fn]();
                    }
                });
                elem.append(item);
            }
        });


        elem.style.left = clientX + "px";
        elem.style.top = clientY + "px"

        if(menuList.length > 0)
            document.body.append(elem);

    }
}

window.addEventListener("load", () => {
    const dbname = "BMIF";
    const version = 2;

    db = new Database({dbname, version});
    db.request.addEventListener("success", () => {
        app = new App(); 
    });
});