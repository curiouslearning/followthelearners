const learnersCountElementId = 'learners-count';

$(document).ready(function() {
  const $navbarBurgers = Array.prototype.slice.call(
    document.querySelectorAll('.navbar-burger'), 0);

  if ($navbarBurgers.length > 0) {
    $navbarBurgers.forEach( el => {
      el.addEventListener('click', () => {

        const target = el.dataset.target;
        const $target = document.getElementById(target);

        el.classList.toggle('is-active');
        $target.classList.toggle('is-active');
        $target.style.backgroundColor = 
          $target.classList.contains('is-active') ? 
          "#8CCDC9" : 
          "rgba(0, 0, 0, 0)";
      });
    });
  }

  $.get('/allLearnersCount', { }, function(data, status) {
    if (!data) {
      console.log("Couldn't get count data for All Learners!");
      return;
    }
    let learnersCounter = new CountUp(learnersCountElementId, 
      data.allLearnersCount, { 
      useEasing: true,
      useGrouping: true,
      duration: 5
    });
    if (!learnersCounter.error) {
      learnersCounter.start();
    } else {
      console.log(learnersCounter.error);
    }
  })
});