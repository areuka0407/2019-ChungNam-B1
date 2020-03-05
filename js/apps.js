var app;

Element.prototype.setStyle = function(lists){
    for(let prop in lists){
        this.style[prop] = lists;
    }
}

class App {
    constructor(){
        this.init();    
    }

    async init(){
        
        this.event();
    }

    event(){
        let needToggleActive = ["#open-manage", "#open-create", "#page-create .tool .name"];
        needToggleActive.forEach(select => {
            document.querySelectorAll(select).forEach(elem => {
                elem.addEventListener("click", e => e.currentTarget.classList.toggle("active"));
            });
        });
    }
}

window.addEventListener("load", () => {
    app = new App();
});