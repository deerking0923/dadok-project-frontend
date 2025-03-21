"use client"
import React, { useEffect, useState } from "react";
import axios from "axios";
import styles from "./BookReviewSection.module.css";

interface Review {
  id: number;
  isbn: string;
  userId: string;
  createDate: string; // ISO 형식 날짜 문자열
  content: string;
}

interface UserProfileInfo {
  name: string;
}

interface BookReviewSectionProps {
  isbn: string;
}

const BookReviewSection: React.FC<BookReviewSectionProps> = ({ isbn }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userNames, setUserNames] = useState<{ [key: string]: string }>({});
  const [newReview, setNewReview] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // 편집 관련 상태
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");

  // 현재 로그인한 사용자 ID (localStorage에서 동적으로 가져옴)
  const currentUserId =
    typeof window !== "undefined" ? localStorage.getItem("userId") : null;

  // 환경 변수에서 API_GATEWAY_URL 불러오기 (클라이언트 코드이므로 NEXT_PUBLIC_ 접두사가 필요합니다.)
  const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL;

  // 리뷰 목록을 가져오는 함수
  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get<Review[]>(
        `${API_GATEWAY_URL}/bookreview-service/reviews/isbn/${isbn}`
      );
      setReviews(res.data);
    } catch (err) {
      console.error(err);
      setError("리뷰를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // userNames 캐싱: 각 리뷰의 userId에 해당하는 사용자 이름을 조회
  const fetchUserName = async (userId: string) => {
    if (userNames[userId]) return;
    try {
      const res = await axios.get<UserProfileInfo>(
        `${API_GATEWAY_URL}/user-service/users/${userId}`
      );
      setUserNames((prev) => ({ ...prev, [userId]: res.data.name }));
    } catch (err) {
      console.error(err);
      setUserNames((prev) => ({ ...prev, [userId]: userId }));
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [isbn]);

  // reviews가 업데이트되면 각 리뷰의 작성자 이름을 조회
  useEffect(() => {
    reviews.forEach((review) => {
      if (!userNames[review.userId]) {
        fetchUserName(review.userId);
      }
    });
  }, [reviews]);

  // 리뷰 등록 함수
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");
    if (!token || !userId) {
      alert("로그인이 필요합니다.");
      return;
    }
    try {
      const newReviewData = {
        id: Date.now(), // Temporarily assigning a unique ID for the new review
        isbn,
        userId,
        createDate: new Date().toISOString(),
        content: newReview,
      };
      // Optimistically update the UI with the new review
      setReviews((prevReviews) => [newReviewData, ...prevReviews]);
      setNewReview("");

      // Post the review to the backend
      await axios.post(
        `${API_GATEWAY_URL}/bookreview-service/${userId}/reviews`,
        newReviewData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchReviews(); // Fetch latest reviews from the server after posting
    } catch (err) {
      console.error(err);
      setError("리뷰 등록에 실패했습니다.");
    }
  };

  // 리뷰 수정 함수
  const handleEditSubmit = async (reviewId: number) => {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");
    if (!token || !userId) {
      alert("로그인이 필요합니다.");
      return;
    }
    try {
      await axios.put(
        `${API_GATEWAY_URL}/bookreview-service/${userId}/reviews/${reviewId}`,
        {
          content: editingContent,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditingReviewId(null);
      setEditingContent("");
      fetchReviews(); // 최신 리뷰 가져오기
    } catch (err) {
      console.error(err);
      setError("리뷰 수정에 실패했습니다.");
    }
  };

  // 리뷰 삭제 함수 (삭제 확인 메시지 추가)
  const handleDelete = async (reviewId: number) => {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");
    if (!token || !userId) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!window.confirm("삭제하시겠습니까?")) return;
    try {
      // Optimistically remove the review from the UI
      setReviews((prevReviews) => prevReviews.filter((review) => review.id !== reviewId));
      await axios.delete(
        `${API_GATEWAY_URL}/bookreview-service/${userId}/reviews/${reviewId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchReviews(); // Fetch latest reviews from the server after deleting
    } catch (err) {
      console.error(err);
      setError("리뷰 삭제에 실패했습니다.");
    }
  };

  return (
    <div className={styles.reviewSection}>
      <h2>서평</h2>
      {loading ? (
        <p>리뷰 로딩 중...</p>
      ) : error ? (
        <p className={styles.error}>{error}</p>
      ) : reviews.length > 0 ? (
        <ul className={styles.reviewList}>
          {reviews.map((review) => (
            <li key={review.id} className={styles.reviewItem}>
              <div className={styles.reviewHeader}>
                {/* 날짜를 왼쪽 상단으로 이동 */}
                <span className={styles.reviewDate}>
                  {new Date(review.createDate).toLocaleDateString()}
                </span>
              </div>
              {/* 작성자 이름 표시 */}
              <p className={styles.reviewAuthor}>
                작성자: {userNames[review.userId] || review.userId}
              </p>
              {editingReviewId === review.id ? (
                <>
                  <textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className={styles.reviewInput}
                  />
                  <button
                    onClick={() => handleEditSubmit(review.id)}
                    className={styles.submitButton}
                  >
                    저장
                  </button>
                  <button
                    onClick={() => {
                      setEditingReviewId(null);
                      setEditingContent("");
                    }}
                    className={styles.cancelButton}
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <p className={styles.reviewContent}>{review.content}</p>
                  {currentUserId === review.userId && (
                    <div className={styles.actionButtons}>
                      <button
                        onClick={() => {
                          setEditingReviewId(review.id);
                          setEditingContent(review.content);
                        }}
                        className={styles.editButton}
                      >
                        <img
                          src="/edit_icon.png"
                          alt="Edit"
                          className={styles.icon}
                        />
                      </button>
                      <button
                        onClick={() => handleDelete(review.id)}
                        className={styles.deleteButton}
                      >
                        <img
                          src="/delete_icon.png"
                          alt="Delete"
                          className={styles.icon}
                        />
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>작성된 리뷰가 없습니다.</p>
      )}

      <form onSubmit={handleSubmit} className={styles.reviewForm}>
        <textarea
          value={newReview}
          onChange={(e) => setNewReview(e.target.value)}
          placeholder="리뷰를 입력하세요..."
          className={styles.reviewInput}
          required
        />
        <button type="submit" className={styles.submitButton}>
          리뷰 등록
        </button>
      </form>
    </div>
  );
};

export default BookReviewSection;
