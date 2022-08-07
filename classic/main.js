const constraints = window.constraints = {
    audio: false,
    video: true
  };
  
  function onSuccess(stream) {
    const video = document.getElementById('usersVideo');
    const videoTracks = stream.getVideoTracks();
    console.log('Got stream with constraints:', constraints);
    console.log(`Using video device: ${videoTracks[0].label}`);
    window.stream = stream; // make variable available to browser console
    video.srcObject = stream;
  }
  
  function catchError(error) {
    if (error.name === 'OverconstrainedError') {
      const v = constraints.video;
      sendErrorMsg(`The resolution ${v.width.exact}x${v.height.exact} px is not supported by your device.`);
    } else if (error.name === 'NotAllowedError') {
      sendErrorMsg('カメラとマイクの使用が許可されていません。');
    }
    sendErrorMsg(`getUserMedia error: ${error.name}`, error);
  }
  
  function sendErrorMsg(msg, error) {
    const errorElement = document.getElementById('msgBox');
    errorElement.innerHTML += `<p>${msg}</p>`;
    if (typeof error !== 'undefined') {
      console.error(error);
    }
  }
  
  async function init(e) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      onSuccess(stream);
      e.target.disabled = true;
    } catch (e) {
      catchError(e);
    }
  }
  
  document.getElementById("openCam").addEventListener('click', e => init(e));