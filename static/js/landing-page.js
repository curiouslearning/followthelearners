const learnersCountElementId = 'learners-count';
const learnersCountParentId = 'learners-parent';

$(document).ready(function() {
  const $navbarBurgers = Array.prototype.slice.call(
      document.querySelectorAll('.navbar-burger'), 0);

  if ($navbarBurgers.length > 0) {
    $navbarBurgers.forEach((el) => {
      el.addEventListener('click', () => {
        const target = el.dataset.target;
        const $target = document.getElementById(target);

        el.classList.toggle('is-active');
        $target.classList.toggle('is-active');
        $target.style.backgroundColor =
          $target.classList.contains('is-active') ? '#8CCDC9' : 'rgba(0,0,0,0)';
      });
    });
  }

  $.get('/allLearnersCount', { }, function(data, status) {
    if (!data) {
      console.log('Couldn\'t get count data for All Learners!');
      return;
    }
    const learnersParent = document.getElementById(learnersCountParentId);
    if (learnersParent) {
      learnersParent.style.opacity = 1;
    }
    const learnersCounter = new CountUp(learnersCountElementId,
        data.allLearnersCount, {
          useEasing: true,
          useGrouping: true,
          duration: 5,
        });
    if (!learnersCounter.error) {
      learnersCounter.start();
    } else {
      console.log(learnersCounter.error);
    }
  });
});

let deferredPrompt;
const addBtn = document.querySelector('.add-button');
addBtn.style.display = 'none';

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  // Update UI to notify the user they can add to home screen
  addBtn.style.display = 'block';

  addBtn.addEventListener('click', (e) => {
    // hide our user interface that shows our A2HS button
    addBtn.style.display = 'none';
    // Show the prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the A2HS prompt');
        } else {
          console.log('User dismissed the A2HS prompt');
        }
        deferredPrompt = null;
      });
  });
});
