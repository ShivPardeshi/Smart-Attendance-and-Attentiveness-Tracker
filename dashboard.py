import streamlit as st
import pandas as pd
import os
import glob
import plotly.express as px

st.set_page_config(page_title="Smart Classroom Dashboard", layout="wide")

st.title("🎓 Smart Classroom Attendance & Attentiveness Dashboard")

# Find log files
log_files = glob.glob("logs/session_*.csv")

if not log_files:
    st.warning("No session logs found in the 'logs/' directory. Run the tracker first!")
else:
    # Let user select session
    log_file = st.selectbox("Select Session to View", sorted(log_files, reverse=True))
    
    # Load data
    df = pd.read_csv(log_file)
    
    if df.empty:
        st.info("The selected session log is empty.")
    else:
        # 1. Overall Metrics
        st.header("Overall Session Session Summary")
        
        # Calculate distinct students present
        students_present = df['name'].unique()
        students_present = [s for s in students_present if str(s) != "nan" and s != "Unknown"]
        
        # Calculate global attentiveness
        total_frames = len(df)
        attentive_frames = len(df[df['is_attentive'] == True])
        distracted_frames = len(df[df['is_distracted'] == True])
        drowsy_frames = len(df[df['is_drowsy'] == True])
        
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Students Present", len(students_present))
        
        att_rate = (attentive_frames / total_frames * 100) if total_frames > 0 else 0
        col2.metric("Overall Attentiveness", f"{att_rate:.1f}%")
        
        col3.metric("Distracted Events", distracted_frames)
        col4.metric("Drowsiness Events", drowsy_frames)
        
        # 2. Timeline Chart
        st.header("Class Attentiveness Timeline")
        
        # Process over time (bin into frames)
        if len(df) > 0:
            timeline_df = df.groupby('frame_id')['is_attentive'].mean().reset_index()
            timeline_df['Attentiveness %'] = timeline_df['is_attentive'] * 100
            fig = px.line(timeline_df, x="frame_id", y="Attentiveness %",
                          title="Average Class Attentiveness Over Time",
                          labels={"frame_id": "Time (Frames)", "Attentiveness %": "% Attentive"})
            fig.update_layout(yaxis_range=[0,100])
            st.plotly_chart(fig, use_container_width=True)
            
        # 3. Individual Student Analysis
        st.header("Individual Student Analysis")
        if students_present:
            selected_student = st.selectbox("Select Student", ["All"] + list(students_present))
            
            if selected_student == "All":
                display_df = df
            else:
                display_df = df[df['name'] == selected_student]
                
            student_att = len(display_df[display_df['is_attentive'] == True])
            student_tot = len(display_df)
            st_rate = (student_att / student_tot * 100) if student_tot > 0 else 0
            
            st.write(f"**{selected_student}** was attentive **{st_rate:.1f}%** of the time.")
            
            # Show a pie chart for the student
            breakdown = pd.DataFrame({
                "Status": ["Attentive", "Distracted", "Drowsy"],
                "Count": [
                    len(display_df[display_df['is_attentive'] == True]),
                    len(display_df[display_df['is_distracted'] == True]),
                    len(display_df[display_df['is_drowsy'] == True]),
                ]
            })
            
            fig_pie = px.pie(breakdown, values='Count', names='Status', title=f"Attentiveness Breakdown for {selected_student}")
            st.plotly_chart(fig_pie)
            
        else:
            st.info("No known students were identified in this session.")
