$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $favoritedArticles = $("#favorited-articles")
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navStory = $("#nav-story");
  const $navLogOut = $("#nav-logout");
  const $navFaves = $("#nav-faves");
  const $userProfile = $('#nav-user-profile');
  const $sectionUserProfile = $('#user-profile');
  const $myStories = $("#nav-my-stories")

  // global storyList variable
  let storyList = null;
  // global currentUser variable
  let currentUser = null;
  //delete items and store them in localStorage to filter them out
  let removed = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    if(currentUser.ownStories.size>0){
        $myStories.show();
        $userProfile.show();
        $('#nav-user-profile').append(currentUser.username);
    }
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */
  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function(e) {
    disableButtonListener(e);
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });

  /**
   * Event handler for Getting Form to add a new story
   */

  $navStory.on("click", function(e) {
    disableButtonListener(e);
    toggleBetweenForms();
    $submitForm.show();
    $sectionUserProfile.hide();
  });

  $submitForm.on("submit", async function(e){
    e.preventDefault();
    // grab the required fields
    let author = $("input#author").val();
    let title = $("input#title").val();
    let url = $("input#url").val();
    toggleBetweenForms();
    $myStories.show()
    // call the create method, which calls the API and then builds a new user instance
    const newStory = await StoryList.addStory(currentUser,{author,title,url});
    const res = generateStoryHTML(newStory);
    $allStoriesList.prepend(res);
    currentUser.ownStories.add(newStory.storyId);
    syncCurrentUserToLocalStorage();
  });

  $userProfile.on('click',function(e){
    disableButtonListener(e);
    toggleBetweenForms();
    $submitForm.hide();
    $sectionUserProfile.show();
    $('#profile-name').html(`Name: <b>${currentUser.name}</b>`);
    $('#profile-username').html(`Username: <b>${currentUser.username}</b>`);
    $('#profile-account-date').html(`Account Created: <b>${currentUser.createdAt}</b>`);
  })

  $(document).on('click','i',function(){
    $(this).toggleClass('text-warning');
    if(!currentUser.favorites.has($(this).parent().attr("id"))){
      currentUser.favorites.add($(this).parent().attr("id"));
    } else {
      currentUser.favorites.delete($(this).parent().attr("id"));
    }
    currentUser.favorites.size > 0?$navFaves.show():$navFaves.hide();
    syncCurrentUserToLocalStorage();
  });

  $(document).on('click','a.remove',function(e){
    const boundRemoveStory = deleteStory.bind($(this));
    boundRemoveStory(currentUser.favorites);
    boundRemoveStory(currentUser.ownStories);
    removed.add($(this).parent().attr("id"))
    $(this).parent().remove();
    syncCurrentUserToLocalStorage();
  });

  $navFaves.on('click', async function(e){
    disableButtonListener(e);
    $ownStories.hide();
    await generateStories();
    return whichStories(currentUser.favorites,$favoritedArticles);
  });

  $myStories.on('click',async function(e){
    disableButtonListener(e);
    $favoritedArticles.hide();
    await generateStories();
    return whichStories(currentUser.ownStories,$ownStories);
  });


  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);

    if (currentUser) {
      $('#nav-welcome').show();
      currentUser.favorites = new Set(JSON.parse(localStorage.getItem('favorites')));
      if(currentUser.favorites.size>0){
        $navFaves.show();
      }
      currentUser.ownStories = new Set(JSON.parse(localStorage.getItem('ownStories')));
      if(currentUser.ownStories.size>0){
        $myStories.show();
      }
      showNavForLoggedInUser();
      $('#nav-user-profile').append(currentUser.username);
      $userProfile.show();
    }
    await generateStories();
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();
    //get our filtered set
    removed = new Set(JSON.parse(localStorage.getItem('removedStories')));
    // loop through all of our stories and generate HTML for them
    for (let $story of storyList.stories) {
      const $result = generateStoryHTML($story);
      if(removed.has($story.storyId)){
        $filteredArticles.append($result);
      } else{
        $allStoriesList.append($result);
      }
    }
    $filteredArticles.empty();
  }

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story) {
    let hostName = getHostName(story.url);
    let color = '';
    if(currentUser){
      if(currentUser.favorites.has(story.storyId)){
        color='text-warning';
      }
    }
    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        <i class="fas fa-star ${color}"></i>
        <a class="article-link" href="${story.url}" target="a_blank">
           <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
        <a class="remove text-dark">delete</a>
      </li>
    `);
    return storyMarkup;
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $favoritedArticles,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
      $sectionUserProfile
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function disableButtonListener(e){
    const navButtons = [
      $myStories,
      $userProfile,
      $navFaves,
      $navStory,
      $('#nav-all')
    ];
    navButtons.forEach(function($btn){
      if($btn[0].id === e.target.id){
        $btn.css('pointer-events', 'none').css("color","white");
      } else {
        $btn.css('pointer-events', 'auto').css("color","black");
      }
    })
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navStory.show();
    $navLogOut.show();
  }

  function toggleBetweenForms(){
    $allStoriesList.hide();
    $favoritedArticles.empty();
    $ownStories.empty();
  }

  function hideForms(){
    $submitForm.hide();
    $sectionUserProfile.hide();
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
      localStorage.setItem('favorites',JSON.stringify([...currentUser.favorites]));
      const myStories = [];
      for(let story of [...currentUser.ownStories]){
        myStories.push(story);
      }
      localStorage.setItem('ownStories',JSON.stringify(myStories));
      localStorage.setItem('removedStories',JSON.stringify([...removed]));
    }
  }

  function whichStories(stories, articles){
    toggleBetweenForms();
    articles.show();
    hideForms();
    let i=0;
    while(i<$('#all-articles-list li').length){
      const $story = $('#all-articles-list li').eq(i);
      if(stories.has($('#all-articles-list li').eq(i).attr("id"))){
        articles.append($story.clone());
      }
      i++;
    }
  }

  //delete story from the page
  function deleteStory(story){
    if(story.has($(this).parent().attr("id"))){
      story.delete($(this).parent().attr("id"));
    }
  }
});




