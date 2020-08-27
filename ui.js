$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $editProfileForm = $("#edit-profile-form");
  const $filteredArticles = $("#filtered-articles");
  const $favoritedArticles = $("#favorited-articles")
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("ul li a#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navStory = $("#nav-story");
  const $navFaves = $("#nav-faves");
  const $userProfile = $('#nav-user-profile');
  const $sectionUserProfile = $('#edit-profile-form');
  const $myStories = $("#nav-my-stories");

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

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
    if(currentUser){
      ifCurrentUser();
    }
    await generateStories();
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /*
    Update your profile password or name
   */

  $editProfileForm.on('submit', async function(e){
    e.preventDefault();
    const newName = $("input#update-account-name").val();
    const newPassword = $("input#update-account-password").val();
    let update;
    try{
      update = await currentUser.updateUser(newName,newPassword);
      addProfileData(update.user.name,currentUser.username,update.user.createdAt);
      alert('Congrats!!! Your profile was updated!!!');
      $sectionUserProfile.hide();
      $allStoriesList.show()
      $userProfile.css('pointer-events', 'auto').css("color","black");
      $('#nav-all').css('pointer-events', 'none').css("color","white");
    } catch(e){
      alert("Some error has occured. Try later...");
    }
  })

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh
    //check if user has already registered under this name
    try{
      // grab the required fields
      let name = $("#create-account-name").val();
      let username = $("#create-account-username").val();
      let password = $("#create-account-password").val();

      // call the create method, which calls the API and then builds a new user instance
      const newUser = await User.create(username, password, name);
      currentUser = newUser;
      syncCurrentUserToLocalStorage();
      loginAndSubmitForm();
    } catch(error){
      if(error.response){
        alert(error.response.data.error.message);
      }
    }
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
    $favoritedArticles.empty();
    $ownStories.empty();
    await generateStories();
    $allStoriesList.show();
  });

  //toggle and update account
  $userProfile.on('click',function(e){
    disableButtonListener(e);
    toggleBetweenForms();
    $submitForm.hide();
    $sectionUserProfile.show();
    addProfileData(currentUser.name,currentUser.username,currentUser.createdAt);
  });

  $myStories.on('touchstart click',async function(e){
    disableButtonListener(e);
    $favoritedArticles.hide();
    whichStories(setStories(currentUser.ownStories),$ownStories);
  });

  $navFaves.on('touchstart click', async function(e){
    disableButtonListener(e);
    $ownStories.hide();
    whichStories(setStories(currentUser.favorites),$favoritedArticles);
  });

  $navStory.on("click", function(e) {
    $('h4#title-add-update').text('Add Story');
    disableButtonListener(e);
    toggleBetweenForms();
    $submitForm.show();
    $sectionUserProfile.hide();
  });

  //add or update eventListeners
  $submitForm.on("submit", async function(e){
    e.preventDefault();
    // grab the required fields
    let author = $("input#author").val();
    let title = $("input#title").val();
    let url = $("input#url").val();
    toggleBetweenForms();
    $myStories.show();
    if($('h4#title-add-update').text() == 'Update Story'){
      updateExistingStory(author,title,url);
    } else {
      // call the create method, which calls the API and then builds a new user instance
      addNewStory(author,title,url);
    }
  });

  //get a dialogue form to update myStory
  $(document).on('click','i.fas.fa-pencil-alt',function(e){
    const $title = e.target.parentElement.parentElement.children[1].innerText;
    const $link = e.target.parentElement.parentElement.children[1].href;
    const $author = e.target.parentElement.parentElement.children[2].innerText.split('by ')[1];
    $('input#author').attr('value', $author);
    $('input#title').attr('value', $title);
    $('input#url').attr('value', $link);
    disableButtonListener(e);
    toggleBetweenForms();
    $submitForm.show();
    $sectionUserProfile.hide();
    $('h4#title-add-update').text('Update Story').attr('data-id',e.target.parentElement.parentElement.id);
  });

  /* remove your story from the page */

  $(document).on('click','i.far.fa-trash-alt',async function(e){
    let res;
    try{
      e.preventDefault(); // no page-refresh on submit
      res = await StoryList.deleteStory(currentUser,$(this).parent().parent().attr("id"));
      $(this).parent().parent().remove();
      await reloadPage();
      if(!currentUser.ownStories.length){
        $myStories.hide();
      }
    } catch(error){
      console.log(error);
    }
  });

  /* add or remove favorite story*/

  $(document).on('click','i.fas.fa-star',async function(){
    $(this).toggleClass('text-warning');
    const $storyid = $(this).parent().attr("id");
    if($(this).hasClass('text-warning')){
      await currentUser.addFavoriteStory($storyid);
      await reloadPage();
    } else {
      await currentUser.deleteFavoriteStory($storyid);
      await reloadPage();
    }
    currentUser.favorites.length > 0?$navFaves.show():$navFaves.hide();
  });

  /* hide NavBar when <li> is clicked in Mobile or smaller screens*/

  $('#myTopnav li').on('click', ()=> $("#check")[0].checked = false);

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */
  async function reloadPage(){
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    return currentUser;
  }

  async function checkIfLoggedIn() {
    
    //get current user
    const currentUser = await reloadPage();
    if (currentUser) {
      ifCurrentUser();
      showNavForLoggedInUser();
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

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story, false);
      $allStoriesList.append(result);
    }
  }

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story, flag) {
    let hostName = getHostName(story.url),
        color = '',
        edit = '',
        dlt = '';
    if(currentUser){
      if(setStories(currentUser.favorites).has(story.storyId)){
        color='text-warning';
      }
      if(setStories(currentUser.ownStories).has(story.storyId) || flag){
        edit = '<i class="fas fa-pencil-alt d-inline"></i>';
        dlt = '<i class="far fa-trash-alt d-inline pr-2"></i>';
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
        <a class="remove text-dark trash-can">${dlt}</a>
        <a class="edit text-dark">${edit}</a>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
      $sectionUserProfile
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  /* Get nav bar and buttons available when signed in */

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navStory.show();
    $navLogOut.show();
  }

  function ifCurrentUser(){
    if(currentUser.ownStories.length>0){
      $myStories.show();
    }
    if(currentUser.favorites.length>0){
      $navFaves.show();
    }
    $userProfile.show();
    $('#nav-user-profile').append(currentUser.username);
  }

  /* disable a nav bar button if on that page */

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

  /* hide/show forms */

  function toggleBetweenForms(){
    $allStoriesList.hide();
    $favoritedArticles.hide();
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
    }
  }

  /* display favorite or ownStories */

  async function whichStories(stories, articles){
    toggleBetweenForms();
    await generateStories();
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
  
  /* build set out of array */

  function setStories(stories){
    const set = new Set(stories.map(s => s.storyId));
    return set;
  }
  
  //update story and refresh page
  async function updateExistingStory(author,title,url){
    await StoryList.updateStory(currentUser,{author,title,url},$('h4#title-add-update').attr('data-id'));
    $allStoriesList.empty();
    await generateStories();
    successStory("Successfully Updated!!!")
  }
  
  /*add story and refresh page*/

  async function addNewStory(author,title,url){
    // call the create method, which calls the API and then builds a new user instance
    let newStory = await StoryList.addStory(currentUser,{author,title,url});
    const res = generateStoryHTML(newStory,true);
    $allStoriesList.prepend(res);
    successStory("Successfully Created!!!")
  }

  /* message after successfull add/update */

  async function successStory(message){
    alert(message);
    await reloadPage();
    $submitForm.hide();
    $submitForm[0].reset();
    // show the stories
    $allStoriesList.show();
  }

  /*display profile information*/

  function addProfileData(name,username,createdAt){
    $('#profile-name').html(`Name: <b>${name}</b>`);
    $('#profile-username').html(`Username: <b>${username}</b>`);
    $('#profile-account-date').html(`Account Created: <b>${createdAt}</b>`);
  }

});
