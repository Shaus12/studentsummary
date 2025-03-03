// Add polling functionality to check summary status
function checkSummaryStatus(videoUrl) {
  // Start polling for updates
  const intervalId = setInterval(async () => {
    try {
      const response = await fetch('/api/summary-status?url=' + encodeURIComponent(videoUrl), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to check summary status');
      }
      
      const data = await response.json();
      
      // If the summary is no longer processing, update the UI and stop polling
      if (!data.isProcessing) {
        setSummary(data.summary);
        setPdfPath(data.pdfPath);
        clearInterval(intervalId);
      }
    } catch (error) {
      console.error('Error checking summary status:', error);
      clearInterval(intervalId);
    }
  }, 5000); // Check every 5 seconds
  
  // Store the interval ID so we can clear it later if needed
  return intervalId;
}

// Update the handleSubmit function to start polling
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError(null);
  
  try {
    const response = await fetch('/api/process-youtube', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        url: youtubeUrl,
        outputType: outputType,
        summaryOptions: {
          style: style,
          format: format,
          language: language,
          maxPoints: maxPoints
        }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to process YouTube video');
    }
    
    const data = await response.json();
    setSummary(data.summary);
    setPdfPath(data.pdfPath);
    
    // Start polling for updates
    const intervalId = checkSummaryStatus(youtubeUrl);
    
    // Store the interval ID in state or ref so we can clear it when component unmounts
    setPollingIntervalId(intervalId);
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
};

// Add cleanup when component unmounts
useEffect(() => {
  return () => {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
    }
  };
}, [pollingIntervalId]); 