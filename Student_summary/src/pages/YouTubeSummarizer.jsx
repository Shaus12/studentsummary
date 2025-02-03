import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Select,
  MenuItem,
} from '@mui/material';

const YouTubeSummarizer = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [summaryType, setSummaryType] = useState('medium');

  const summaryOptions = [
    { value: 'transcription', label: 'תמלול ההקלטה' },
    { value: 'extended', label: 'סיכום מורחב' },
    { value: 'medium', label: 'סיכום בינוני' },
    { value: 'general', label: 'סיכום כללי' },
    { value: 'short', label: 'סיכום קצר' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/summarize-youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, summaryType }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to summarize video');
      }
      
      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      setError('אירעה שגיאה בעיבוד הסרטון');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ pt: '64px' }}>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Paper 
          elevation={1} 
          sx={{ 
            p: 4, 
            borderRadius: 2,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <Typography 
            variant="h4" 
            component="h1" 
            gutterBottom 
            align="center"
            sx={{ mb: 4, fontWeight: 'normal' }}
          >
            סכם סרטון YouTube
          </Typography>
          
          <Box component="form" onSubmit={handleSubmit}>
            <div className="input-group">
              <TextField
                fullWidth
                placeholder="הכנס קישור ל-YouTube"
                variant="outlined"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1,
                  }
                }}
              />
              
              <Select
                value={summaryType}
                onChange={(e) => setSummaryType(e.target.value)}
                sx={{
                  '& .MuiSelect-select': {
                    padding: '10px 14px',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 0, 0, 0.23)',
                  },
                }}
              >
                {summaryOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </div>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{ 
                py: 1.5,
                bgcolor: '#1976d2',
                borderRadius: 1,
                textTransform: 'uppercase',
                fontWeight: 'normal'
              }}
            >
              {loading ? 'מעבד...' : 'סכם סרטון'}
            </Button>
          </Box>

          {error && <div className="error">{error}</div>}
          {summary && (
            <div className="summary-result">
              <h3>הסיכום שלך:</h3>
              <div className="summary-content">{summary}</div>
            </div>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default YouTubeSummarizer; 