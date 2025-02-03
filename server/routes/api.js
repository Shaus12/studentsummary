router.post('/summarize-youtube', async (req, res) => {
  try {
    const { url, summaryType } = req.body;
    const result = await processYouTubeVideo(url, summaryType);
    res.json(result);
  } catch (error) {
    console.error('Error processing YouTube video:', error);
    res.status(500).json({ error: 'Failed to process video' });
  }
}); 