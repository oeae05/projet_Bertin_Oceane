document.addEventListener("DOMContentLoaded", () => {
    const bouton = document.getElementById("bouton");
    const message = document.getElementById("message");
    let compteur = 0;

    bouton.addEventListener("click", () => {
        compteur++;
        message.textContent = `Bouton cliqué ${compteur} fois`;
    });
});
